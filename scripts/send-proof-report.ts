/**
 * Send one proof report to SentinelFlowReceiver on Base Sepolia (simulates CRE output).
 * Loads cre/.env (CRE_ETH_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL) and cre/sentinelflow/config.staging.json.
 *
 * Usage (from repo root):
 *   npx hardhat run scripts/send-proof-report.ts --network baseSepolia -- "{\"deviationBps\": 100, \"reason\": \"within band\"}"
 * Or set PAYLOAD in env (from cre/.env not loaded by Hardhat, so use -e or run with dotenv).
 *
 * For sequential runs (A then B then C then D), run this script 4 times with different payloads.
 */
import { ethers } from "hardhat";
import * as path from "path";
import * as fs from "fs";

// Load cre/.env so CRE_ETH_PRIVATE_KEY and BASE_SEPOLIA_RPC_URL are set
require("dotenv").config({ path: path.join(__dirname, "..", "cre", ".env") });

const PAYLOAD_ARG = process.argv.find((a) => a.startsWith("{")) || process.env.PAYLOAD;

/** Must match cre/sentinelflow/main.ts deterministicDecisionId for verify-tx to pass. */
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

function buildReportFromPayload(
  body: { deviationBps?: number; reason?: string },
  config: {
    receiver: string;
    deviationBpsThreshold: number;
    pauseBpsThreshold: number;
    policyId?: string;
  }
) {
  const deviationBps = Number(body.deviationBps ?? 0);
  const reason = String(body.reason ?? "");
  const policyId = config.policyId ?? "SENTINELFLOW_POLICY_V0";

  let actionType: "NO_ACTION" | "SET_RISK_MODE" | "PAUSE" = "NO_ACTION";
  if (deviationBps >= config.pauseBpsThreshold) actionType = "PAUSE";
  else if (deviationBps >= config.deviationBpsThreshold) actionType = "SET_RISK_MODE";

  const setRiskMode = actionType === "SET_RISK_MODE";
  const timestamp = Math.floor(Date.now() / 1000);
  const decisionId = deterministicDecisionId(
    config.receiver,
    policyId,
    deviationBps,
    actionType,
    timestamp
  );
  const baseReason = reason || (actionType !== "NO_ACTION" ? "threshold exceeded" : "within band");
  const severity = actionType === "PAUSE" ? "CRITICAL" : actionType === "SET_RISK_MODE" ? "HIGH" : "LOW";
  const confidence = actionType === "PAUSE" ? 0.9 : actionType === "SET_RISK_MODE" ? 0.8 : 0.7;
  const reasonWithAi = `${baseReason} | AI: ${actionType} | severity=${severity} | conf=${confidence}`;
  return {
    setRiskMode,
    decisionId,
    policyId,
    signalType: "PRICE_DEVIATION_BPS",
    signalValue: deviationBps,
    actionType,
    success: true,
    reason: reasonWithAi,
  };
}

function encodeReport(
  setRiskMode: boolean,
  decisionId: string,
  policyId: string,
  signalType: string,
  signalValue: number,
  actionType: string,
  success: boolean,
  reason: string
): string {
  const decisionIdBytes =
    decisionId.length === 66 ? decisionId : ethers.keccak256(ethers.toUtf8Bytes(decisionId));
  const policyIdBytes =
    policyId.length === 66 ? policyId : ethers.keccak256(ethers.toUtf8Bytes(policyId));
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bool", "bytes32", "bytes32", "string", "int256", "string", "bool", "string"],
    [setRiskMode, decisionIdBytes, policyIdBytes, signalType, signalValue, actionType, success, reason]
  );
}

async function main() {
  if (!PAYLOAD_ARG) {
    console.error("Usage: npx hardhat run scripts/send-proof-report.ts --network baseSepolia -- '{\"deviationBps\": 100, \"reason\": \"within band\"}'");
    console.error("Or set PAYLOAD env (e.g. PAYLOAD='{\"deviationBps\":100,\"reason\":\"within band\"}')");
    process.exitCode = 1;
    return;
  }

  const body = JSON.parse(PAYLOAD_ARG) as { deviationBps?: number; reason?: string };
  const configPath = path.join(__dirname, "..", "cre", "sentinelflow", "config.staging.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    receiver: string;
    deviationBpsThreshold: number;
    pauseBpsThreshold: number;
    policyId?: string;
  };

  const report = buildReportFromPayload(body, config);
  const encoded = encodeReport(
    report.setRiskMode,
    report.decisionId,
    report.policyId,
    report.signalType,
    report.signalValue,
    report.actionType,
    report.success,
    report.reason
  );

  // Use CRE key so msg.sender matches forwarder (deployer/forwarder address)
  const pk = process.env.CRE_ETH_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error("Set CRE_ETH_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) in cre/.env");
    process.exitCode = 1;
    return;
  }
  const key = pk.startsWith("0x") ? pk : "0x" + pk;
  const rpc = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(key, provider);

  const receiver = await ethers.getContractAt("SentinelFlowReceiver", config.receiver);
  const tx = await receiver.connect(wallet).onReport("0x", encoded);
  const rec = await tx.wait();

  console.log("actionType:", report.actionType);
  console.log("decisionId:", report.decisionId);
  console.log("txHash:", rec?.hash);
  console.log("blockNumber:", rec?.blockNumber);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
