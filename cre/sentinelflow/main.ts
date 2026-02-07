/**
 * SentinelFlow CRE workflow: HTTP trigger + 2-tier policy (NO_ACTION | SET_RISK_MODE | PAUSE).
 * Optional: PRICE_FEED signal mode, AI advisor (logged), incident bundle output.
 */
import fs from "node:fs";
import path from "node:path";
import {
  HTTPCapability,
  handler,
  Runner,
  decodeJson,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { aiSuggest, type AiSuggestion } from "./aiAdvisor";

type ExecutionMode = "EXECUTE" | "DRY_RUN";

function normalizeExecutionMode(m: unknown): ExecutionMode {
  return m === "DRY_RUN" ? "DRY_RUN" : "EXECUTE";
}

type Config = {
  chainName: string;
  receiver: string;
  gasLimit: string;
  deviationBpsThreshold: number;
  pauseBpsThreshold: number;
  riskModeWhenExceeded: number;
  signalMode?: "HTTP" | "PRICE_FEED";
  feedAddressEthUsd?: string;
  baselinePriceUsd?: string;
  executionMode?: ExecutionMode | unknown;
};

type RequestBody = {
  deviationBps?: number;
  reason?: string;
  meta?: Record<string, unknown>;
};

type ActionType = "NO_ACTION" | "SET_RISK_MODE" | "PAUSE";

const AGGREGATOR_V3_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

function validateConfig(config: Config): void {
  if (!config.receiver || typeof config.receiver !== "string") {
    throw new Error("Config missing or invalid: receiver");
  }
  const risk = Number(config.deviationBpsThreshold);
  const pause = Number(config.pauseBpsThreshold);
  if (Number.isNaN(risk) || risk < 0 || Number.isNaN(pause) || pause < 0 || pause < risk) {
    throw new Error("Config invalid: deviationBpsThreshold and pauseBpsThreshold must be 0 <= risk <= pause");
  }
}

function computeAction(deviationBps: number, config: Config): ActionType {
  if (deviationBps >= config.pauseBpsThreshold) return "PAUSE";
  if (deviationBps >= config.deviationBpsThreshold) return "SET_RISK_MODE";
  return "NO_ACTION";
}

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

function tryWriteIncident(decisionId: string, incident: Record<string, unknown>): string | null {
  try {
    const base =
      typeof import.meta !== "undefined" && (import.meta as { dir?: string }).dir
        ? (import.meta as { dir: string }).dir
        : process.cwd();
    const dir = path.join(base, "incidents");
    fs.mkdirSync(dir, { recursive: true });
    const safeId = decisionId.replace(/[^a-zA-Z0-9-_]/g, "_");
    const outPath = path.join(dir, `${safeId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(incident, null, 2), "utf-8");
    return outPath;
  } catch {
    return null;
  }
}

async function readEthUsd(feedAddress: string, rpcUrl: string): Promise<number> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const [, answer] = await client.readContract({
    address: feedAddress as `0x${string}`,
    abi: AGGREGATOR_V3_ABI,
    functionName: "latestRoundData",
  });
  return Number(answer);
}

function bpsDeviation(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  const diff = Math.abs(current - baseline);
  return Math.floor((diff * 10_000) / baseline);
}

const POLICY_ID = "SENTINELFLOW_POLICY_V0";
const SIGNAL_TYPE = "PRICE_DEVIATION_BPS";

const onHttpTrigger = async (runtime: Runtime<Config>, payload: HTTPPayload): Promise<string> => {
  validateConfig(runtime.config);
  const config = runtime.config;
  const body = decodeJson(payload.input) as RequestBody;
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

  let deviationBps = Number(body?.deviationBps ?? 0);
  let meta: Record<string, unknown> = body?.meta ?? {};
  let signalValue = deviationBps;

  if (config.signalMode === "PRICE_FEED" && config.feedAddressEthUsd && config.baselinePriceUsd) {
    const baseline = Number(config.baselinePriceUsd);
    const current = await readEthUsd(config.feedAddressEthUsd, rpcUrl);
    deviationBps = bpsDeviation(current, baseline);
    signalValue = deviationBps;
    meta = {
      ...meta,
      signalMode: "PRICE_FEED",
      feed: config.feedAddressEthUsd,
      baselinePriceUsd: baseline,
      currentPriceUsd: current,
    };
  }

  const reason = String(body?.reason ?? "");
  const actionType = computeAction(deviationBps, config);
  const executionMode = normalizeExecutionMode(config.executionMode);
  let finalActionType: ActionType = actionType;
  let shadowAction: string | null = null;
  if (executionMode === "DRY_RUN" && actionType !== "NO_ACTION") {
    shadowAction = actionType;
    finalActionType = "NO_ACTION";
  }
  const setRiskMode = finalActionType === "SET_RISK_MODE";
  const exceeded = actionType !== "NO_ACTION";

  const ai: AiSuggestion = aiSuggest({
    deviationBps,
    riskThreshold: Number(config.deviationBpsThreshold),
    pauseThreshold: Number(config.pauseBpsThreshold),
    signalType: SIGNAL_TYPE,
  });
  const aiLine = `AI: ${ai.recommendedAction} | severity=${ai.severity} | conf=${ai.confidence}`;
  const reasonWithAi = reason ? `${reason} | ${aiLine}` : aiLine;
  const finalReason = reason || (exceeded ? "threshold exceeded" : "within band");
  const reasonForLog = `${finalReason} | ${aiLine}`;

  const timestamp = Math.floor(Date.now() / 1000);
  const decisionId = deterministicDecisionId(
    config.receiver,
    POLICY_ID,
    signalValue,
    actionType,
    timestamp
  );

  const metaOut: Record<string, unknown> = {
    ...(Object.keys(meta).length ? meta : {}),
    executionMode,
    ...(shadowAction ? { shadowAction } : {}),
  };
  const incidentBundle: Record<string, unknown> = {
    decisionId,
    policyId: POLICY_ID,
    actionTypeComputed: actionType,
    actionTypeExecuted: finalActionType,
    ...(shadowAction ? { shadowAction } : {}),
    exceeded,
    signal: { signalType: SIGNAL_TYPE, signalValue },
    thresholds: {
      risk: config.deviationBpsThreshold,
      pause: config.pauseBpsThreshold,
    },
    meta: Object.keys(metaOut).length ? metaOut : null,
    reason: reasonForLog,
    txHash: null,
    receiver: config.receiver,
    chainName: config.chainName,
    createdAt: new Date().toISOString(),
    ai,
  };
  const incidentPath = tryWriteIncident(decisionId, incidentBundle);

  runtime.log(
    `SentinelFlow: deviationBps=${deviationBps} reason=${reason} actionType=${actionType} exceeded=${exceeded} executionMode=${executionMode}${shadowAction ? ` shadowAction=${shadowAction}` : ""}`
  );

  return JSON.stringify({
    decisionId,
    actionType: finalActionType,
    setRiskMode,
    exceeded,
    deviationBps,
    reason: reasonForLog,
    executionMode,
    ...(shadowAction ? { shadowAction } : {}),
    ai,
    incidentPath,
    incidentBundle: incidentPath ? { decisionId, path: incidentPath } : null,
  });
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();
  return [handler(http.trigger({}), onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
