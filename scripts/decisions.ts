import { ethers } from "hardhat";

/**
 * Pull last N DecisionLogged events from DecisionJournal.
 * Usage: LIMIT=15 npx hardhat run scripts/decisions.ts --network baseSepolia
 * Optional: FROM_BLOCK=12345 DECISION_JOURNAL_ADDRESS=0x...
 */
const DEFAULT_JOURNAL = "0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E";

async function main() {
  const journalAddr = process.env.DECISION_JOURNAL_ADDRESS ?? DEFAULT_JOURNAL;
  const limit = Number(process.env.LIMIT ?? "10");
  const lookback = Number(process.env.LOOKBACK_BLOCKS ?? "9");

  const journal = await ethers.getContractAt("DecisionJournal", journalAddr);
  const filter = journal.filters.DecisionLogged();
  const latest = await ethers.provider.getBlockNumber();
  const fromBlock = process.env.FROM_BLOCK ? Number(process.env.FROM_BLOCK) : Math.max(0, latest - lookback);
  const toBlock = Math.min(latest, fromBlock + lookback);
  const events = await journal.queryFilter(filter, fromBlock, toBlock);
  const recent = events.slice(-limit);

  console.log(`=== DecisionJournal: last ${recent.length} events ===`);
  for (const ev of recent) {
    const a = ev.args!;
    console.log({
      blockNumber: ev.blockNumber,
      txHash: ev.transactionHash,
      decisionId: a.decisionId,
      policyId: a.policyId,
      signalType: a.signalType,
      signalValue: a.signalValue.toString(),
      actionType: a.actionType,
      success: a.success,
      reason: a.reason,
      timestamp: a.timestamp.toString(),
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
