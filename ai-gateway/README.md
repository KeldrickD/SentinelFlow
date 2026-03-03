# SentinelFlow AI Gateway (real x402 seller – Option B1)

We use the **`x402-express`** middleware package for the seller gateway and **`@x402/fetch`** for the buyer auto-pay wrapper.

x402 payment-gated `POST /analyze` using **x402-express** middleware and testnet facilitator. First request returns **402** with **`PAYMENT-REQUIRED`**; client pays and retries with **`PAYMENT-SIGNATURE`**; server returns **200** with **`PAYMENT-RESPONSE`** (settlement).

## Setup

```bash
cp .env.example .env
# Set PAY_TO_ADDRESS (your wallet), OPENAI_API_KEY
npm install
npm start
```

## Env

| Var | Description |
|-----|-------------|
| `PAY_TO_ADDRESS` | Wallet to receive payment (0x..., Base Sepolia) |
| `X402_PRICE` | Price per call (e.g. `$0.01`) |
| `X402_FACILITATOR_URL` | Facilitator URL (default `https://x402.org/facilitator` for testnet) |
| `OPENAI_API_KEY` | OpenAI API key |

## Endpoints

- **POST /analyze** — Body: `{ deviationBps, riskThreshold, pauseThreshold, signalType, executionMode }`. Without payment → **402** + **`PAYMENT-REQUIRED`**. CRE (buyer) retries with **`PAYMENT-SIGNATURE`**; gateway verifies via facilitator and returns 200 + AI JSON + **`PAYMENT-RESPONSE`**.
- **GET /health** — `{ status, x402, facilitator, payTo }`.

## CRE as buyer

Set `aiMode: "GATEWAY"` and `aiEndpoint: "http://localhost:8080/analyze"`. In `cre/.env` set **`X402_BUYER_EVM_PRIVATE_KEY`** (funded Base Sepolia wallet with USDC). The workflow uses **@x402/fetch** to auto handle 402 → pay → retry.

## Demo flow

1. Start gateway: `cd ai-gateway && npm i && npm start`
2. Run CRE simulate with GATEWAY mode; first call gets 402, then auto-pay retry returns 200.

---

#### Production switch (Option B2: CDP facilitator)

In production, replace the public facilitator URL with a hosted facilitator you control (or a CDP-integrated facilitator). The gateway code remains the same; only facilitator configuration changes.

**Env changes**

* `X402_FACILITATOR_URL` → set to your production facilitator endpoint
* `X402_PRICE` → set to real pricing (e.g. `$0.05` per analysis)
* `PAY_TO_ADDRESS` → set to treasury address (multi-sig recommended)

**Buyer changes**

* CRE's `X402_BUYER_EVM_PRIVATE_KEY` should be a dedicated service wallet with spending limits.
* Optionally route payment through a payment service / sponsored wallet pattern.

**Notes**

* Keep `aiPolicy=DEESCALATE_ONLY` in production to prevent AI-triggered escalation.
* Log and persist `PAYMENT-RESPONSE` receipts for audit and reconciliation.

**B2 readiness checklist** (~1 min read)

* [ ] Run your own facilitator (or use a managed facilitator)
* [ ] Put gateway behind HTTPS + auth allowlist (optional)
* [ ] Rotate and protect buyer key (HSM or managed secrets)
* [ ] Add rate limits + request signing
* [ ] Reconcile receipts from `PAYMENT-RESPONSE`
