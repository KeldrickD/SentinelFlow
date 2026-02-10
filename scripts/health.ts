import { ethers } from "hardhat";

type Health = {
  network: string;
  receiver: string;
  opsTarget: string;
  decisionJournal: string;
  forwarder?: string;
  cooldownSeconds?: number;
  executor: string;
  paused: boolean;
  riskMode: number;
  lastDecision?: {
    txHash: string;
    blockNumber: number;
    actionType: string;
    success: boolean;
    signalType: string;
    signalValue: string;
    reason: string;
    timestamp: string;
  };
  verdict: "OK" | "WARN" | "ALERT";
  notes: string[];
};

async function main() {
  const receiverAddr =
    process.env.RECEIVER_ADDRESS ?? "0x245D1D0A023Ca58847223981BFC6222c8d296d2B";
  const opsAddr =
    process.env.OPS_TARGET_ADDRESS ?? "0xba108988F8E43C7D892C5d24c5171Fcd6b138C2C";
  const journalAddr =
    process.env.DECISION_JOURNAL_ADDRESS ?? "0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E";

  const net = await ethers.provider.getNetwork();

  const receiver = await ethers.getContractAt("SentinelFlowReceiver", receiverAddr);
  const ops = await ethers.getContractAt("OpsTarget", opsAddr);
  const journal = await ethers.getContractAt("DecisionJournal", journalAddr);

  const [executor, paused, riskMode] = await Promise.all([
    ops.executor(),
    ops.paused(),
    ops.riskMode(),
  ]);

  const health: Health = {
    network: `${net.name} (${net.chainId})`,
    receiver: receiverAddr,
    opsTarget: opsAddr,
    decisionJournal: journalAddr,
    executor,
    paused,
    riskMode: Number(riskMode),
    verdict: "OK",
    notes: [],
  };

  try {
    health.forwarder = await receiver.forwarder();
  } catch {
    // ignore
  }
  try {
    const cd = await receiver.cooldownSeconds();
    health.cooldownSeconds = Number(cd);
  } catch {
    // ignore
  }

  const lookback = Number(process.env.LOOKBACK_BLOCKS ?? "9");
  const latest = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookback);
  const toBlock = Math.min(latest, fromBlock + lookback);

  const events = await journal.queryFilter(journal.filters.DecisionLogged(), fromBlock, toBlock);
  const last = events[events.length - 1];

  if (last?.args) {
    health.lastDecision = {
      txHash: last.transactionHash ?? "",
      blockNumber: last.blockNumber,
      actionType: last.args.actionType,
      success: last.args.success,
      signalType: last.args.signalType,
      signalValue: last.args.signalValue.toString(),
      reason: last.args.reason,
      timestamp: last.args.timestamp.toString(),
    };
  } else {
    health.notes.push("No DecisionLogged events found in lookback window.");
    health.verdict = "WARN";
  }

  if (paused) {
    health.verdict = "ALERT";
    health.notes.push("OpsTarget is PAUSED (incident state).");
  } else if (health.riskMode >= 2) {
    health.verdict = "WARN";
    health.notes.push("OpsTarget riskMode is in elevated state (>=2).");
  }

  if (health.lastDecision) {
    if (health.lastDecision.actionType === "COOLDOWN_BLOCKED") {
      health.notes.push("Last decision was COOLDOWN_BLOCKED (cooldown protecting state).");
      if (health.verdict === "OK") health.verdict = "WARN";
    }
    if (!health.lastDecision.success) {
      health.notes.push("Last logged decision was not successful (check receiver/ops call).");
      health.verdict = "WARN";
    }
  }

  console.log(JSON.stringify(health, null, 2));

  if (health.verdict === "ALERT") {
    console.log("\nNEXT STEP SUGGESTION: Investigate incident. If this is a demo, show PAUSE tx + logs.");
  } else if (health.verdict === "WARN") {
    console.log("\nNEXT STEP SUGGESTION: Show last decision and verify tx determinism with verify-tx.ts.");
  } else {
    console.log("\nNEXT STEP SUGGESTION: Run a DRY_RUN workflow invocation or a controlled EXECUTE run.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
