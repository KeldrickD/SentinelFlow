# Backend Structure

## Components

| Component | Role |
|-----------|------|
| **CRE Workflow** (`cre/sentinelflow/`) | Orchestration: HTTP trigger → policy + AI suggestion → guardrail → executionMode → report shape. Runs in CRE CLI or CRE network. |
| **SentinelFlowReceiver** (Solidity) | Validates report, logs to DecisionJournal, calls OpsTarget (setRiskMode / pause). Single trust boundary. |
| **OpsTarget** (Solidity) | Holds paused / riskMode state; only executable by receiver. |
| **DecisionJournal** (Solidity) | Append-only DecisionLogged events. |
| **AI Gateway** (`ai-gateway/`) | Express server; `POST /analyze` requires x402 payment header; calls OpenAI; returns same JSON shape as aiLLM. |
| **Hardhat scripts** | Deploy, status, health, decisions, runbook, verify-tx, export-incident, send-proof-report. |

## Data Flow

1. **Signal** → HTTP payload or PRICE_FEED (Chainlink) → deviationBps.
2. **Policy** → computeAction(deviationBps, config) → computed action.
3. **AI** → STUB / LLM / GATEWAY → recommendedAction; guardrail(computed, ai, policy) → actionAfterGuardrail.
4. **Execution** → DRY_RUN may force NO_ACTION and set shadowAction; else finalActionType = actionAfterGuardrail.
5. **Onchain** → send-proof-report or CRE --broadcast encodes report → receiver.onReport → journal + ops.
6. **Incident** → Bundle written to `cre/sentinelflow/incidents/` or exported via `export-incident.ts`.

## Responsibilities

- **CRE**: orchestration, policy, AI call, guardrail, incident bundle, response JSON.
- **AI Gateway**: x402 check, OpenAI call, return AiSuggestionLLM shape.
- **Contracts**: state enforcement, audit log, no business logic beyond validation and forwarding.
