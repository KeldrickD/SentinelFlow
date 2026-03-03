# APIs

## AI Gateway (ai-gateway)

Real x402 seller (Option B1): uses **x402-express** middleware and testnet facilitator. First request returns **402** with **PAYMENT-REQUIRED**; client pays and retries with **PAYMENT-SIGNATURE**; server returns **200** with **PAYMENT-RESPONSE** (settlement).

### POST /analyze

Payment-gated AI suggestion for CRE workflow (x402).

**Request**

- **Headers**
  - `Content-Type: application/json`
  - (First call: no payment → 402. Retry with **PAYMENT-SIGNATURE** after paying via facilitator.)
- **Body**
  ```json
  {
    "deviationBps": 300,
    "riskThreshold": 250,
    "pauseThreshold": 700,
    "signalType": "PRICE_DEVIATION_BPS",
    "executionMode": "EXECUTE"
  }
  ```

**Response (200)**

```json
{
  "severity": "HIGH",
  "recommendedAction": "SET_RISK_MODE",
  "confidence": 0.82,
  "rationale": "Deviation above risk threshold.",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "latencyMs": 623
}
```

- **Header** **PAYMENT-RESPONSE**: settlement confirmation (after payment).

**Response (402 Payment Required)**

- **Header** **PAYMENT-REQUIRED**: payment requirements (scheme, network, amount, destination, resource). Buyer uses **@x402/fetch** (or similar) to pay and retry with **PAYMENT-SIGNATURE**.
- **Body**: `{ "error": "Payment Required (x402)", "message": "..." }`.

### GET /health

- **Response (200)**  
  `{ "status": "ok", "x402": true, "facilitator": "...", "payTo": "0x..." }`

---

## CRE Workflow (HTTP trigger)

The CRE workflow is invoked by the CRE CLI (simulate or deploy). It accepts an HTTP payload and returns JSON.

**Input (HTTP body)**

```json
{
  "deviationBps": 300,
  "reason": "price feed drift",
  "meta": {}
}
```

**Output (JSON string)**

Includes `decisionId`, `actionType`, `setRiskMode`, `exceeded`, `deviationBps`, `reason`, `executionMode`, `shadowAction` (if DRY_RUN), `policyVersion`, `policyHash`, `ai`, `incidentPath`, `incidentBundle`.

---

## Hardhat scripts (CLI)

- **status.ts** — Reads receiver, OpsTarget, DecisionJournal state.
- **health.ts** — JSON health report + recommendations.
- **decisions.ts** — Last N DecisionLogged events.
- **ops-runbook.ts** — Runbook JSON + quick commands.
- **verify-tx.ts** — Decode tx + determinism check (requires `TX_HASH`).
- **export-incident.ts** — Export incident JSON to `incident_exports/` (requires `TX_HASH`).
- **send-proof-report.ts** — Send one report onchain (requires `PAYLOAD` and CRE key).

Env: `RECEIVER_ADDRESS`, `OPS_TARGET_ADDRESS`, `DECISION_JOURNAL_ADDRESS`, `LOOKBACK_BLOCKS`, `LIMIT`, `TX_HASH`, `POLICY_ID`, etc. See README.
