/**
 * AI Advisor: suggests severity and action; policy engine remains deterministic.
 * Stub is rules-based for demos; swap with real LLM later via same interface.
 */

export type AiSuggestion = {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedAction: "NO_ACTION" | "SET_RISK_MODE" | "PAUSE";
  confidence: number;
  rationale: string;
};

export function aiSuggest(params: {
  deviationBps: number;
  riskThreshold: number;
  pauseThreshold: number;
  signalType: string;
}): AiSuggestion {
  const { deviationBps, riskThreshold, pauseThreshold, signalType } = params;

  if (deviationBps >= pauseThreshold) {
    return {
      severity: "CRITICAL",
      recommendedAction: "PAUSE",
      confidence: 0.9,
      rationale: `${signalType} deviation extremely high (>= pause threshold).`,
    };
  }
  if (deviationBps >= riskThreshold) {
    return {
      severity: "HIGH",
      recommendedAction: "SET_RISK_MODE",
      confidence: 0.8,
      rationale: `${signalType} deviation above risk threshold; recommend tightening controls.`,
    };
  }
  return {
    severity: "LOW",
    recommendedAction: "NO_ACTION",
    confidence: 0.7,
    rationale: `${signalType} deviation within acceptable band.`,
  };
}
