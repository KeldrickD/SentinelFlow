import { ethers } from "hardhat";

/**
 * Recompute decisionId string exactly like CRE main.ts deterministicDecisionId.
 * Onchain we store keccak256(utf8(decisionIdString)).
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
  const journalAddr =
    process.env.DECISION_JOURNAL_ADDRESS ?? "0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E";
  const receiverAddr =
    process.env.RECEIVER_ADDRESS ?? "0x245D1D0A023Ca58847223981BFC6222c8d296d2B";
  const policyIdString = process.env.POLICY_ID ?? "SENTINELFLOW_POLICY_V0";

  if (!txHash) throw new Error("Set TX_HASH env var.");

  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction receipt not found (wrong network?)");

  const journal = await ethers.getContractAt("DecisionJournal", journalAddr);
  const iface = journal.interface;

  const topic = iface.getEvent("DecisionLogged").topicHash;
  const log = receipt.logs.find(
    (l) =>
      l.address.toLowerCase() === journalAddr.toLowerCase() && l.topics[0] === topic
  );

  if (!log) {
    throw new Error(
      "No DecisionLogged event found in this tx for the configured DecisionJournal."
    );
  }

  const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
  const args = parsed?.args as {
    decisionId: string;
    policyId: string;
    signalType: string;
    signalValue: bigint;
    actionType: string;
    success: boolean;
    reason: string;
    timestamp: bigint;
  };

  if (!args) throw new Error("Failed to parse DecisionLogged args.");

  const decisionId = args.decisionId;
  const policyId = args.policyId;
  const signalType = args.signalType;
  const signalValue = args.signalValue;
  const actionType = args.actionType;
  const success = args.success;
  const reason = args.reason;
  const timestamp = args.timestamp;

  console.log("=== DecisionLogged (decoded) ===");
  console.log({
    txHash,
    decisionId,
    policyId,
    signalType,
    signalValue: signalValue.toString(),
    actionType,
    success,
    reason,
    timestamp: timestamp.toString(),
    receiver: receiverAddr,
    journal: journalAddr,
  });

  // PolicyId onchain is bytes32 = keccak256(utf8(policyIdString)). Optional check.
  const expectedPolicyIdBytes = ethers.keccak256(ethers.toUtf8Bytes(policyIdString));
  const policyIdMatches =
    expectedPolicyIdBytes.toLowerCase() === policyId.toLowerCase();
  if (!policyIdMatches) {
    console.log(
      "\nNOTE: Event policyId (bytes32) does not match keccak256(utf8(POLICY_ID)). Using POLICY_ID for recompute anyway."
    );
  }

  const recomputedString = deterministicDecisionId(
    receiverAddr,
    policyIdString,
    Number(signalValue),
    actionType,
    Number(timestamp)
  );
  const recomputedBytes32 = ethers.keccak256(ethers.toUtf8Bytes(recomputedString));

  const ok = recomputedBytes32.toLowerCase() === decisionId.toLowerCase();

  console.log("\n=== Determinism Check ===");
  console.log("Recomputed string:", recomputedString);
  console.log("Recomputed bytes32:", recomputedBytes32);
  console.log("Matches event decisionId:", ok ? "✅ YES" : "❌ NO");

  if (!ok) {
    console.log(
      "\nNOTE: If this doesn't match, the tx may have been produced with a different receiver, policyId, or decisionId algorithm. Check RECEIVER_ADDRESS and POLICY_ID."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
