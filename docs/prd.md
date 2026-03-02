# Product Requirements Document (PRD)

## Vision

SentinelFlow is an **AI-assisted onchain operations monitor** powered by Chainlink CRE. It evaluates risk signals (e.g. price deviation), uses deterministic policy plus optional LLM advice, and executes bounded actions (risk mode, pause) on a protected OpsTarget with full auditability.

## Core Capabilities

- **Deterministic policy evaluation** — Thresholds (riskBps, pauseBps) → NO_ACTION | SET_RISK_MODE | PAUSE
- **AI-assisted decisioning** — STUB (rules), LLM (OpenAI), or GATEWAY (x402-paid endpoint); guardrail ensures AI cannot escalate beyond policy
- **Execution modes** — EXECUTE (onchain) or DRY_RUN (shadow action only)
- **Policy manifest + policyHash** — Reproducible, provable rules
- **DecisionJournal** — Append-only log of every decision
- **Incident bundle** — Offchain JSON per run (policy hash, AI suggestion, guardrail result)
- **Ops tooling** — status, health, decisions, runbook, verify-tx, export-incident

## CRE & AI Track Requirements

- CRE workflow integrates **at least one blockchain** (Base Sepolia) and **external API / LLM / AI** (OpenAI or AI Gateway).
- Demonstrate **simulation via CRE CLI** or live deployment.
- **3–5 minute public video** showing workflow execution or simulation.
- **Public source code** (e.g. GitHub) and **README with links to all Chainlink-using files**.

## Success Criteria

- CRE simulate runs with `aiMode=STUB` and `aiMode=LLM` (with API key).
- Onchain DecisionLogged events include AI line in reason; incident bundle includes `ai.provider`, `ai.model`, `latencyMs`, `actionTypeAfterGuardrail`.
- AI Gateway returns 402 when `x402-payment` missing (when `X402_REQUIRE_PAYMENT` is set).
