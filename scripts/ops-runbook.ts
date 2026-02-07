import { ethers } from "hardhat";

type Runbook = {
  network: string;
  receiver: string;
  opsTarget: string;
  decisionJournal: string;
  state: { paused: boolean; riskMode: number; executor: string };
  receiverMeta?: { forwarder?: string; cooldownSeconds?: number };
  recentDecisions: Array<{
    txHash: string;
    blockNumber: number;
    actionType: string;
    success: boolean;
    signalType: string;
    signalValue: string;
    reason: string;
    timestamp: string;
  }>;
  verdict: "OK" | "WARN" | "ALERT";
  recommendations: string[];
};

async function main() {
  const receiverAddr =
    process.env.RECEIVER_ADDRESS ?? "0x245D1D0A023Ca58847223981BFC6222c8d296d2B";
  const opsAddr =
    process.env.OPS_TARGET_ADDRESS ?? "0xba108988F8E43C7D892C5d24c5171Fcd6b138C2C";
  const journalAddr =
    process.env.DECISION_JOURNAL_ADDRESS ?? "0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E";

  const lookback = Number(process.env.LOOKBACK_BLOCKS ?? "20000");
  const limit = Number(process.env.LIMIT ?? "5");

  const net = await ethers.provider.getNetwork();

  const receiver = await ethers.getContractAt("SentinelFlowReceiver", receiverAddr);
  const ops = await ethers.getContractAt("OpsTarget", opsAddr);
  const journal = await ethers.getContractAt("DecisionJournal", journalAddr);

  const [paused, riskMode, executor] = await Promise.all([
    ops.paused(),
    ops.riskMode(),
    ops.executor(),
  ]);

  const runbook: Runbook = {
    network: `${net.name} (${net.chainId})`,
    receiver: receiverAddr,
    opsTarget: opsAddr,
    decisionJournal: journalAddr,
    state: { paused, riskMode: Number(riskMode), executor },
    receiverMeta: {},
    recentDecisions: [],
    verdict: "OK",
    recommendations: [],
  };

  try {
    runbook.receiverMeta!.forwarder = await receiver.forwarder();
  } catch {
    // ignore
  }
  try {
    runbook.receiverMeta!.cooldownSeconds = Number(await receiver.cooldownSeconds());
  } catch {
    // ignore
  }

  const latest = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookback);

  const events = await journal.queryFilter(journal.filters.DecisionLogged(), fromBlock, "latest");
  const recent = events.slice(-limit);

  for (const ev of recent.reverse()) {
    const a = ev.args!;
    runbook.recentDecisions.push({
      txHash: ev.transactionHash ?? "",
      blockNumber: ev.blockNumber,
      actionType: a.actionType,
      success: a.success,
      signalType: a.signalType,
      signalValue: a.signalValue.toString(),
      reason: a.reason,
      timestamp: a.timestamp.toString(),
    });
  }

  if (paused) {
    runbook.verdict = "ALERT";
    runbook.recommendations.push("OpsTarget is PAUSED. Treat as active incident state.");
    runbook.recommendations.push("For demos: open the PAUSE tx logs + show DecisionLogged + Paused event.");
    runbook.recommendations.push(
      "For production: define/require a manual recovery path (unpause) with governance controls."
    );
  } else if (runbook.state.riskMode >= 2) {
    runbook.verdict = "WARN";
    runbook.recommendations.push("RiskMode is elevated (>=2). Monitor closely and consider DRY_RUN until stable.");
  }

  const last = runbook.recentDecisions[0];
  if (!last) {
    runbook.verdict = "WARN";
    runbook.recommendations.push(
      `No DecisionLogged events found in last ${lookback} blocks. Verify workflow or forwarder.`
    );
  } else {
    if (last.actionType === "COOLDOWN_BLOCKED") {
      if (runbook.verdict === "OK") runbook.verdict = "WARN";
      runbook.recommendations.push("Last action was COOLDOWN_BLOCKED. Cooldown is preventing repeated escalation.");
      runbook.recommendations.push("Wait for cooldown window, then re-trigger if signal persists.");
    }
    if (!last.success) {
      if (runbook.verdict === "OK") runbook.verdict = "WARN";
      runbook.recommendations.push("Last decision logged success=false. Check receiver routing and ops permissions.");
      runbook.recommendations.push("Run verify-tx to confirm determinism + event contents.");
    }
  }

  console.log("=== SentinelFlow Ops Runbook ===");
  console.log(JSON.stringify(runbook, null, 2));

  console.log("\nQuick Commands:");
  console.log("  - Health:", "npm run health:base");
  console.log("  - Decisions:", "npm run decisions:base");
  console.log("  - Verify tx:", "TX_HASH=0x... npm run verify:base");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
