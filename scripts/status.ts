import { ethers } from "hardhat";

/**
 * Print SentinelFlow onchain state (receiver, OpsTarget, DecisionJournal).
 * Usage: npx hardhat run scripts/status.ts --network baseSepolia
 * Override via RECEIVER_ADDRESS, OPS_TARGET_ADDRESS, DECISION_JOURNAL_ADDRESS (or uses defaults).
 */
const DEFAULT_RECEIVER = "0x245D1D0A023Ca58847223981BFC6222c8d296d2B";
const DEFAULT_OPS = "0xba108988F8E43C7D892C5d24c5171Fcd6b138C2C";
const DEFAULT_JOURNAL = "0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E";

async function main() {
  const receiverAddress = process.env.RECEIVER_ADDRESS ?? DEFAULT_RECEIVER;
  const opsTargetAddress = process.env.OPS_TARGET_ADDRESS ?? DEFAULT_OPS;
  const journalAddress = process.env.DECISION_JOURNAL_ADDRESS ?? DEFAULT_JOURNAL;

  const receiver = await ethers.getContractAt("SentinelFlowReceiver", receiverAddress);
  const ops = await ethers.getContractAt("OpsTarget", opsTargetAddress);

  const [forwarder, cooldownSeconds, paused, riskMode, executor] = await Promise.all([
    receiver.forwarder(),
    receiver.cooldownSeconds(),
    ops.paused(),
    ops.riskMode(),
    ops.executor(),
  ]);

  console.log("=== SentinelFlow Status (Base Sepolia) ===");
  console.log("Receiver:", receiverAddress);
  console.log("  forwarder:", forwarder);
  console.log("  cooldownSeconds:", cooldownSeconds.toString());
  console.log("OpsTarget:", opsTargetAddress);
  console.log("  executor:", executor);
  console.log("  paused:", paused);
  console.log("  riskMode:", Number(riskMode), "(0=Normal, 1=Caution, 2=Emergency)");
  console.log("DecisionJournal:", journalAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
