import fs from "node:fs";
import path from "node:path";
import { ethers } from "hardhat";

function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * Must match cre/sentinelflow/main.ts and scripts/verify-tx.ts exactly
 * so determinism verification passes.
 */
function deterministicDecisionId(
  receiver: string,
  policyId: string,
  signalValue: number,
  actionType: string,
  timestamp: number
): string {
  const payload = `${receiver}-${policyId}-${signalValue}-${actionType}-${timestamp}`;
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & 0x7fffffff;
  }
  return `sf-${policyId}-${timestamp}-${Math.abs(h).toString(36).slice(0, 8)}`;
}

async function main() {
  const txHash = process.env.TX_HASH;
  if (!txHash) throw new Error("Set TX_HASH env var.");

  const receiverAddr =
    process.env.RECEIVER_ADDRESS ?? "0x245D1D0A023Ca58847223981BFC6222c8d296d2B";
  const opsAddr =
    process.env.OPS_TARGET_ADDRESS ?? "0xba108988F8E43C7D892C5d24c5171Fcd6b138C2C";
  const journalAddr =
    process.env.DECISION_JOURNAL_ADDRESS ?? "0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E";
  const policyIdString = process.env.POLICY_ID ?? "SENTINELFLOW_POLICY_V0";

  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction receipt not found (wrong network?)");

  const journal = await ethers.getContractAt("DecisionJournal", journalAddr);
  const ops = await ethers.getContractAt("OpsTarget", opsAddr);

  const iface = journal.interface;
  const topic = iface.getEvent("DecisionLogged").topicHash;

  const log = receipt.logs.find(
    (l) =>
      l.address.toLowerCase() === journalAddr.toLowerCase() && l.topics[0] === topic
  );
  if (!log)
    throw new Error("No DecisionLogged log found for configured DecisionJournal in this tx.");

  const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
  const a = parsed?.args as {
    decisionId: string;
    policyId: string;
    signalType: string;
    signalValue: bigint;
    actionType: string;
    success: boolean;
    reason: string;
    timestamp: bigint;
  };

  if (!a) throw new Error("Failed to parse DecisionLogged args.");

  const decoded = {
    decisionId: a.decisionId,
    policyId: a.policyId,
    signalType: a.signalType,
    signalValue: a.signalValue.toString(),
    actionType: a.actionType,
    success: a.success,
    reason: a.reason,
    timestamp: a.timestamp.toString(),
  };

  const recomputedString = deterministicDecisionId(
    receiverAddr,
    policyIdString,
    Number(a.signalValue),
    a.actionType,
    Number(a.timestamp)
  );
  const recomputedBytes32 = ethers.keccak256(ethers.toUtf8Bytes(recomputedString));
  const determinismOk = recomputedBytes32.toLowerCase() === a.decisionId.toLowerCase();

  const [paused, riskMode, executor] = await Promise.all([
    ops.paused(),
    ops.riskMode(),
    ops.executor(),
  ]);

  const exportObj = {
    exportedAt: new Date().toISOString(),
    txHash,
    links: {
      tx: `https://sepolia.basescan.org/tx/${txHash}`,
      receiver: `https://sepolia.basescan.org/address/${receiverAddr}`,
      opsTarget: `https://sepolia.basescan.org/address/${opsAddr}`,
      decisionJournal: `https://sepolia.basescan.org/address/${journalAddr}`,
    },
    contracts: { receiver: receiverAddr, opsTarget: opsAddr, decisionJournal: journalAddr },
    stateSnapshot: { paused, riskMode: Number(riskMode), executor },
    decisionLogged: decoded,
    determinism: {
      ok: determinismOk,
      policyIdString,
      recomputedString,
      recomputedBytes32,
    },
  };

  const outDir = path.join(process.cwd(), "incident_exports");
  fs.mkdirSync(outDir, { recursive: true });

  const fileBase = safeFileName(a.decisionId);
  const outPath = path.join(outDir, `${fileBase}.json`);
  fs.writeFileSync(outPath, JSON.stringify(exportObj, null, 2), "utf-8");

  console.log("Exported incident bundle:", outPath);
  console.log("Determinism:", determinismOk ? "✅ VERIFIED" : "❌ MISMATCH");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
