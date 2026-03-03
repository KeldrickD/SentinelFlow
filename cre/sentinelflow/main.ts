/**
 * SentinelFlow CRE workflow: WASM-safe HTTP trigger + policy engine.
 */
import { HTTPCapability, handler, Runner, decodeJson, type Runtime, type HTTPPayload } from "@chainlink/cre-sdk";
import { aiSuggest, type AiSuggestion } from "./aiAdvisor";

type ExecutionMode = "EXECUTE" | "DRY_RUN";
type ActionType = "NO_ACTION" | "SET_RISK_MODE" | "PAUSE";

type Config = {
  chainName: string;
  receiver: string;
  gasLimit: string;
  // ECDSA public key for HTTP trigger auth (0x04 + 128 hex chars)
  httpAuthorizedPublicKey?: string;
  deviationBpsThreshold: number;
  pauseBpsThreshold: number;
  riskModeWhenExceeded: number;
  signalMode?: "HTTP" | "PRICE_FEED";
  feedAddressEthUsd?: string;
  baselinePriceUsd?: string;
  executionMode?: ExecutionMode | unknown;
  policyVersion?: string;
  aiMode?: "STUB" | "LLM" | "GATEWAY";
  aiPolicy?: "DEESCALATE_ONLY" | "ADVISORY_ONLY";
};

type RequestBody = {
  deviationBps?: number;
  reason?: string;
  meta?: Record<string, unknown>;
};

type AiSuggestionLLM = AiSuggestion & {
  provider?: string;
  latencyMs?: number;
};

const POLICY_ID = "SENTINELFLOW_POLICY_V0";
const SIGNAL_TYPE = "PRICE_DEVIATION_BPS";

function normalizeExecutionMode(m: unknown): ExecutionMode {
  return m === "DRY_RUN" ? "DRY_RUN" : "EXECUTE";
}

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj as object).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k])).join(",")}}`;
}

function computePolicyHash(policyObj: Record<string, unknown>): `0x${string}` {
  const canonical = stableStringify(policyObj);
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const shortHex = h.toString(16).padStart(8, "0");
  return (`0x${shortHex.repeat(8)}`) as `0x${string}`;
}

function computeAction(deviationBps: number, config: Config): ActionType {
  if (deviationBps >= config.pauseBpsThreshold) return "PAUSE";
  if (deviationBps >= config.deviationBpsThreshold) return "SET_RISK_MODE";
  return "NO_ACTION";
}

function randomSaltHex(bytes = 8): string {
  const arr = new Uint8Array(bytes);
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return "0x" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function deterministicDecisionIdSalt(
  receiver: string,
  policyId: string,
  signalValue: number,
  actionType: string,
  saltHex: string
): string {
  const payload = `${receiver}-${policyId}-${signalValue}-${actionType}-${saltHex}`;
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & 0x7fffffff;
  }
  return `sf-${policyId}-${saltHex.slice(2, 10)}-${Math.abs(h).toString(36).slice(0, 8)}`;
}

function applyGuardrail(
  policyAction: ActionType,
  aiAction: AiSuggestion["recommendedAction"],
  aiPolicy: "DEESCALATE_ONLY" | "ADVISORY_ONLY"
): ActionType {
  if (aiPolicy === "ADVISORY_ONLY") return policyAction;
  if (policyAction === "PAUSE") return aiAction === "NO_ACTION" ? "NO_ACTION" : aiAction === "SET_RISK_MODE" ? "SET_RISK_MODE" : "PAUSE";
  if (policyAction === "SET_RISK_MODE") return aiAction === "NO_ACTION" ? "NO_ACTION" : "SET_RISK_MODE";
  return "NO_ACTION";
}

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const config = runtime.config;
  const body = decodeJson(payload.input) as RequestBody;
  const policyVersion = (config.policyVersion ?? "v0") as string;
  const policy: Record<string, unknown> = {
    policyId: POLICY_ID,
    thresholds: { riskBps: config.deviationBpsThreshold, pauseBps: config.pauseBpsThreshold },
    version: policyVersion,
    guardrail: config.aiPolicy ?? "DEESCALATE_ONLY",
  };
  const policyHash = computePolicyHash(policy);

  const deviationBps = Number(body?.deviationBps ?? 0);
  const signalValue = deviationBps;
  const reason = String(body?.reason ?? "");
  const meta: Record<string, unknown> = body?.meta ?? {};

  const actionType = computeAction(deviationBps, config);
  const executionMode = normalizeExecutionMode(config.executionMode);
  const aiPolicy = (config.aiPolicy ?? "DEESCALATE_ONLY") as "DEESCALATE_ONLY" | "ADVISORY_ONLY";

  const aiMode = (config.aiMode ?? "STUB") as "STUB" | "LLM" | "GATEWAY";
  const ai: AiSuggestionLLM = aiSuggest({
    deviationBps,
    riskThreshold: Number(config.deviationBpsThreshold),
    pauseThreshold: Number(config.pauseBpsThreshold),
    signalType: SIGNAL_TYPE,
  });
  ai.provider = aiMode === "STUB" ? "stub" : "stub_fallback";
  ai.latencyMs = 0;

  const actionAfterGuardrail = applyGuardrail(actionType, ai.recommendedAction, aiPolicy);
  let finalActionType: ActionType = actionAfterGuardrail;
  let shadowAction: string | null = null;
  if (executionMode === "DRY_RUN" && actionAfterGuardrail !== "NO_ACTION") {
    shadowAction = actionAfterGuardrail;
    finalActionType = "NO_ACTION";
  }

  const saltHex = randomSaltHex(8);
  const aiLine = `AI: ${ai.recommendedAction} | severity=${ai.severity} | conf=${ai.confidence} | ${ai.provider}`;
  const finalReason = reason || (actionType !== "NO_ACTION" ? "threshold exceeded" : "within band");
  const reasonForLog = `${finalReason} | ${aiLine} | salt=${saltHex}`;
  const decisionId = deterministicDecisionIdSalt(config.receiver, POLICY_ID, signalValue, actionAfterGuardrail, saltHex);

  const incidentBundle: Record<string, unknown> = {
    decisionId,
    policyId: POLICY_ID,
    actionTypeComputed: actionType,
    actionTypeAfterGuardrail: actionAfterGuardrail,
    actionTypeExecuted: finalActionType,
    ...(shadowAction ? { shadowAction } : {}),
    exceeded: actionType !== "NO_ACTION",
    signal: { signalType: SIGNAL_TYPE, signalValue },
    thresholds: { risk: config.deviationBpsThreshold, pause: config.pauseBpsThreshold },
    policyVersion,
    policyHash,
    policySnapshot: policy,
    meta: Object.keys(meta).length ? meta : null,
    reason: reasonForLog,
    txHash: null,
    receiver: config.receiver,
    chainName: config.chainName,
    createdAt: new Date().toISOString(),
    ai,
  };

  runtime.log(`SentinelFlow decision=${decisionId} action=${finalActionType}`);

  return JSON.stringify({
    decisionId,
    actionType: finalActionType,
    setRiskMode: finalActionType === "SET_RISK_MODE",
    exceeded: actionType !== "NO_ACTION",
    deviationBps,
    reason: reasonForLog,
    executionMode,
    ...(shadowAction ? { shadowAction } : {}),
    policyVersion,
    policyHash,
    ai,
    incidentPath: null,
    incidentBundle,
  });
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();
  const publicKey = config.httpAuthorizedPublicKey ?? "0x04REPLACE_WITH_UNCOMPRESSED_ECDSA_PUBLIC_KEY";
  return [
    handler(
      http.trigger({
        authorizedKeys: [{ type: "KEY_TYPE_ECDSA_EVM", publicKey }],
      }),
      onHttpTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
