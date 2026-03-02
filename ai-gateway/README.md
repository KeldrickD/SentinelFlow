# SentinelFlow AI Gateway

x402 payment-gated `POST /analyze` endpoint for the CRE workflow. Used when `cre/sentinelflow` config has `aiMode: "GATEWAY"` and `aiEndpoint: "http://localhost:8080/analyze"` (or your deployed URL).

## Setup

```bash
cp .env.example .env
# Set OPENAI_API_KEY in .env
npm install
npm start
```

## Endpoints

- **POST /analyze** — Body: `{ deviationBps, riskThreshold, pauseThreshold, signalType, executionMode }`. Requires `x402-payment` header when `X402_REQUIRE_PAYMENT` is not set to `false`. Returns AI suggestion (severity, recommendedAction, confidence, rationale, provider, model, latencyMs).
- **GET /health** — `{ status, x402Required }`.

## CRE integration

In `cre/sentinelflow/config.staging.json`:

```json
"aiMode": "GATEWAY",
"aiEndpoint": "http://localhost:8080/analyze"
```

In `cre/.env` (optional): `X402_PAYMENT_TOKEN=your_token` — sent as `x402-payment` header when the workflow calls the gateway.

## Dev without payment

Set `X402_REQUIRE_PAYMENT=false` in `.env` to allow `/analyze` without the header.
