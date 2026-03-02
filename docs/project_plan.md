# SentinelFlow – CRE & AI Upgrade Plan

## Objective

Extend SentinelFlow to qualify for the **CRE & AI** track by:

- Integrating OpenAI LLM into workflow decisioning
- Adding x402 payment-gated AI endpoint (AI Gateway)
- Maintaining deterministic, guardrailed execution

## Phases

1. **Add LLM mode** — OpenAI-compatible `aiLLM.ts`; config `aiMode: STUB | LLM | GATEWAY`
2. **Add guardrail enforcement** — `DEESCALATE_ONLY` / `ADVISORY_ONLY`; AI can only de-escalate or confirm, never escalate beyond policy
3. **Implement AI Gateway with x402** — `ai-gateway/` Express server; `POST /analyze` requires `x402-payment` header
4. **Integrate CRE to call paid AI endpoint** — When `aiMode=GATEWAY`, workflow calls `config.aiEndpoint` with optional `X402_PAYMENT_TOKEN`
5. **Demo & submission** — 3–5 min video, README with Chainlink file links, public repo

## Out of Scope

- No contract changes / redeploy
- No frontend UI
- No user auth or dashboards

## Success Criteria

- CRE simulation succeeds with `aiMode=STUB` (default) and `aiMode=LLM` (with `OPENAI_API_KEY`)
- Onchain actions remain verifiable; incident bundle includes AI suggestion and guardrail result
- AI Gateway returns 402 without payment, 200 with valid `x402-payment` header
