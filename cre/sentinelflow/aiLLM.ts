/**
 * AI Advisor LLM: OpenAI-compatible API call for CRE & AI track.
 * Returns structured suggestion; fallback to stub on failure.
 */
import { aiSuggest, type AiSuggestion } from "./aiAdvisor";

export type AiSuggestionLLM = AiSuggestion & {
  provider?: string;
  model?: string;
  latencyMs?: number;
};

const VALID_ACTIONS = ["NO_ACTION", "SET_RISK_MODE", "PAUSE"] as const;
const VALID_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function clampConfidence(n: number): number {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

export async function aiSuggestLLM(params: {
  deviationBps: number;
  riskThreshold: number;
  pauseThreshold: number;
  signalType: string;
  executionMode: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
}): Promise<AiSuggestionLLM> {
  const start = Date.now();
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  const endpoint = params.endpoint ?? "https://api.openai.com/v1/chat/completions";
  const model = params.model ?? "gpt-4o-mini";
  const timeoutMs = params.timeoutMs ?? 8000;
  const maxTokens = params.maxTokens ?? 250;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or AI_API_KEY not set for LLM mode");
  }

  const systemPrompt = `You are a risk monitoring AI. Return ONLY valid JSON with no prose.
Keys: severity, recommendedAction, confidence, rationale.
severity: one of LOW, MEDIUM, HIGH, CRITICAL.
recommendedAction: one of NO_ACTION, SET_RISK_MODE, PAUSE.
confidence: number between 0.0 and 1.0.`;

  const userPrompt = `Signal: ${params.signalType}
Deviation BPS: ${params.deviationBps}
Risk Threshold: ${params.riskThreshold}
Pause Threshold: ${params.pauseThreshold}
ExecutionMode: ${params.executionMode}
Return JSON only.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const recommendedAction = String(parsed.recommendedAction ?? "NO_ACTION").toUpperCase();
    const severity = String(parsed.severity ?? "LOW").toUpperCase();
    const action = VALID_ACTIONS.includes(recommendedAction as (typeof VALID_ACTIONS)[number])
      ? (recommendedAction as (typeof VALID_ACTIONS)[number])
      : "NO_ACTION";
    const severityVal = VALID_SEVERITIES.includes(severity as (typeof VALID_SEVERITIES)[number])
      ? (severity as (typeof VALID_SEVERITIES)[number])
      : "LOW";

    const latencyMs = Date.now() - start;
    return {
      severity: severityVal,
      recommendedAction: action,
      confidence: clampConfidence(Number(parsed.confidence)),
      rationale: String(parsed.rationale ?? "").slice(0, 500),
      provider: "openai",
      model,
      latencyMs,
    };
  } catch (err) {
    clearTimeout(timeout);
    const stub = aiSuggest({
      deviationBps: params.deviationBps,
      riskThreshold: params.riskThreshold,
      pauseThreshold: params.pauseThreshold,
      signalType: params.signalType,
    });
    return {
      ...stub,
      provider: "stub_fallback",
      model: "none",
      latencyMs: Date.now() - start,
    };
  }
}

/** Guardrail: AI can only de-escalate or match policy, never escalate beyond computed action. */
export function applyGuardrail(
  computedAction: "NO_ACTION" | "SET_RISK_MODE" | "PAUSE",
  aiAction: string,
  policy: "DEESCALATE_ONLY" | "ADVISORY_ONLY"
): "NO_ACTION" | "SET_RISK_MODE" | "PAUSE" {
  if (policy === "ADVISORY_ONLY") return computedAction;

  const rank: Record<string, number> = { NO_ACTION: 0, SET_RISK_MODE: 1, PAUSE: 2 };
  const aiRank = rank[aiAction] ?? 0;
  const computedRank = rank[computedAction] ?? 0;
  if (aiRank <= computedRank) {
    return aiAction as "NO_ACTION" | "SET_RISK_MODE" | "PAUSE";
  }
  return computedAction;
}
