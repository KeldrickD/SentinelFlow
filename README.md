# SentinelFlow

**SentinelFlow** is an autonomous onchain operations engine built with Chainlink CRE. Offchain workflows evaluate risk signals and submit a single structured report onchain. A receiver contract validates the report, logs every decision for auditability, and conditionally executes safe operational controls (risk-mode changes, pause). This replaces bots and manual ops with deterministic, rule-based automation.

## Architecture (simplified)

```
CRE (offchain)  →  Forwarder  →  SentinelFlowReceiver  →  DecisionJournal (log)
                                              ↘
                                                →  OpsTarget (setRiskMode / pause)
```

- **CRE**: Brain. Accepts HTTP payload (e.g. `deviationBps`, `reason`), applies policy (thresholds), builds one report, sends onchain.
- **SentinelFlowReceiver**: Guardrail + executor. Only accepts calls from trusted forwarder; decodes report; always logs to DecisionJournal; conditionally executes SET_RISK_MODE or PAUSE; enforces cooldown per policy.
- **OpsTarget**: Protected contract. Exposes `setRiskMode(uint8)` and `pause()`; only callable by the receiver (executor).
- **DecisionJournal**: Append-only audit log. Every decision is logged (including NO_ACTION and COOLDOWN_BLOCKED).

## CRE & AI Track Compliance

This project qualifies for **CRE & AI** by integrating a CRE workflow with **blockchain** (Base Sepolia) and **AI** (OpenAI or x402-paid AI Gateway). We use the **`x402-express`** middleware package for the seller gateway and **`@x402/fetch`** for the buyer auto-pay wrapper. The workflow supports `aiMode: STUB | LLM | GATEWAY`; with `LLM`, it calls OpenAI for a suggested action and applies a **guardrail** (e.g. `DEESCALATE_ONLY`). With **GATEWAY**, CRE calls the **AI Gateway** (`ai-gateway/`) which is a **real x402 seller** (Option B1): gateway returns **402** + **PAYMENT-REQUIRED**, CRE uses **@x402/fetch** with **X402_BUYER_EVM_PRIVATE_KEY** to auto pay and retry, then receives **200** + **PAYMENT-RESPONSE**. See **ai-gateway/README.md** and **docs/APIs.md**.

**Chainlink / CRE files (for judge review):**

- [cre/sentinelflow/main.ts](cre/sentinelflow/main.ts) — CRE workflow (HTTP trigger, policy, AI, guardrail, incident bundle)
- [cre/sentinelflow/workflow.yaml](cre/sentinelflow/workflow.yaml) — CRE workflow config
- [cre/project.yaml](cre/project.yaml) — CRE project targets (Base Sepolia)
- [cre/sentinelflow/aiAdvisor.ts](cre/sentinelflow/aiAdvisor.ts) — Stub AI (deterministic)
- [cre/sentinelflow/aiLLM.ts](cre/sentinelflow/aiLLM.ts) — OpenAI-compatible LLM call + guardrail

## Setup

### Environment

Copy the example env files and fill in secrets (do not commit `.env`):

- **Repo root** (for deploy): copy `.env.example` to `.env` and set `DEPLOYER_PRIVATE_KEY`, `FORWARDER_ADDRESS`, etc.
- **CRE** (for simulate): copy `cre/.env.example` to `cre/.env` and set `CRE_ETH_PRIVATE_KEY` (64 hex, no `0x`). This key must be funded on Base Sepolia. For **GATEWAY** + real x402: set **`X402_BUYER_EVM_PRIVATE_KEY=0x...`** (funded Base Sepolia wallet with USDC for payment).

**How to get `FORWARDER_ADDRESS`:**  
For CRE workflow **simulation**, the “forwarder” is the **Ethereum address that sends the report transaction**—i.e. the address of the key in `cre/.env` (`CRE_ETH_PRIVATE_KEY`). CRE does not use a separate forwarder contract in sim; your wallet is the caller. So set `FORWARDER_ADDRESS` to that address. Easiest: use the **same key** for deploy and for CRE (same as `DEPLOYER_PRIVATE_KEY`). Then run:

```bash
npx hardhat run scripts/show-address.ts
```

Copy the printed address into `.env` as `FORWARDER_ADDRESS`. Then deploy; when you run `cre workflow simulate --broadcast`, the tx will be from that address and the receiver will accept it.

### Deploy to Base Sepolia

```bash
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export FORWARDER_ADDRESS=0x...   # CRE forwarder address
export UPDATE_CRE_CONFIG=1
export COOLDOWN_SECONDS=60
npx hardhat run scripts/deploy.ts --network baseSepolia
```

Success: script prints **OpsTarget**, **DecisionJournal**, and **SentinelFlowReceiver** addresses, and updates `cre/sentinelflow/config.staging.json` when `UPDATE_CRE_CONFIG=1`.

### CRE workflow simulate

1. **Install Bun** (required for TypeScript workflows): [bun.sh](https://bun.sh) (1.2.21+).
2. **Install workflow deps** from repo root: `bun install --cwd cre/sentinelflow`
3. **In `cre/.env`:** `CRE_ETH_PRIVATE_KEY` (64 hex, no `0x`), optional `BASE_SEPOLIA_RPC_URL`.
4. **From `cre/` directory:** `cre login` then:

   ```bash
   cd cre
   cre workflow simulate sentinelflow --target staging-settings
   ```

   Select HTTP trigger and enter payload (e.g. `{"deviationBps": 100, "reason": "within band"}`). See **cre/README.md** and **DEMO.md** for payloads and optional `--broadcast`.

## Tests

```bash
npx hardhat test
```

Covers: invalid sender, NO_ACTION, SET_RISK_MODE, PAUSE, cooldown blocking and expiry.

## Read on-chain status (optional)

After deploy, print receiver config, OpsTarget state (paused, riskMode), and recent decisions:

```bash
npx hardhat run scripts/status.ts --network baseSepolia
npx hardhat run scripts/decisions.ts --network baseSepolia
npx hardhat run scripts/health.ts --network baseSepolia
```

Or use package scripts: `npm run status:base`, `npm run health:base`, `npm run decisions:base`. Health prints a JSON verdict (OK/WARN/ALERT), last decision, and a suggested next step. To verify a tx’s DecisionLogged determinism: `TX_HASH=0x... npx hardhat run scripts/verify-tx.ts --network baseSepolia` (or `npm run verify:base` with `TX_HASH` set). Ops runbook: `npm run runbook:base`. Export incident to JSON: `TX_HASH=0x... npm run export:base`. Defaults use the deployed addresses above; override with env vars. Scripts that query logs (health, decisions, runbook) default to a 9-block lookback so they work on free RPC tiers; set `LOOKBACK_BLOCKS=2000` (or higher) if your RPC allows larger `eth_getLogs` ranges.

## Live Demo Proof (Base Sepolia)

**Deployed addresses:**

| Contract | Address |
|---------|---------|
| SentinelFlowReceiver | [`0x245D1D0A023Ca58847223981BFC6222c8d296d2B`](https://sepolia.basescan.org/address/0x245D1D0A023Ca58847223981BFC6222c8d296d2B) |
| OpsTarget | [`0xba108988F8E43C7D892C5d24c5171Fcd6b138C2C`](https://sepolia.basescan.org/address/0xba108988F8E43C7D892C5d24c5171Fcd6b138C2C) |
| DecisionJournal | [`0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E`](https://sepolia.basescan.org/address/0x1e67FB0b1f763f1A89F6D6DaDf165bE8F2Cfc60E) |

**Proof transactions (report → receiver → journal ± ops):**

| Payload | Expected | Tx |
|---------|----------|-----|
| A) NO_ACTION (100 bps) | Journal only | [`0x2c78...93a8`](https://sepolia.basescan.org/tx/0x2c78889ab0101566c76e3443a2c1086ddc0e9e7eeea19657874feaa215db93a8) |
| B) SET_RISK_MODE (300 bps) | Journal + riskMode=2 | [`0x1e7c...af2fd`](https://sepolia.basescan.org/tx/0x1e7cac106628b8b52016beebfe0a5662e94ee573d434f5457ef50778411af2fd) |
| C) PAUSE (900 bps) | Journal + paused | [`0xe05f...f280a`](https://sepolia.basescan.org/tx/0xe05f1255585c23fe961cfe50bae4fc976779f6715d0c4e8186d530557c1f280a) |
| D) COOLDOWN_BLOCKED (repeat B) | Journal, actionType=COOLDOWN_BLOCKED | [`0xfff4...0ca77`](https://sepolia.basescan.org/tx/0xfff48f9e2e96ce505341a9061188aa7e153170f10d45fe7e55bb8d8e99f0ca77) |

Reproduce with: `PAYLOAD='{"deviationBps":100,"reason":"within band"}' npx hardhat run scripts/send-proof-report.ts --network baseSepolia` (see DEMO.md).

### Golden demo path (4 commands)

Run in order (after deploy and env are set):

1. **Health** — `npm run health:base`
2. **Send one new report** — `PAYLOAD="{\"deviationBps\":100,\"reason\":\"golden demo\"}" npx hardhat run scripts/send-proof-report.ts --network baseSepolia` — copy the printed `txHash`
3. **Verify** — `TX_HASH=<tx_hash> npm run verify:base` → expect **✅ YES**
4. **Export** — `TX_HASH=<tx_hash> npm run export:base` → writes `incident_exports/<decisionId>.json`

Use the tx from step 2 in the **Proof tx (verifies ✅)** row below.

### Proof tx (verifies ✅)

| Description | Tx |
|-------------|-----|
| Golden proof (NO_ACTION, current repo) | _Paste tx hash from golden step 2_ |

Older txs (A/B/C/D above) may show ❌ on verify (previous decisionId format). New txs from current repo verify.

### x402 flow (AI Gateway)

We use the **`x402-express`** middleware package for the seller gateway and **`@x402/fetch`** for the buyer auto-pay wrapper. B1 (demo) uses the public testnet facilitator; for production (B2) see **Production switch (Option B2)** below.

1. Client calls `POST /analyze` without payment → server returns **402** and **`PAYMENT-REQUIRED`** header (scheme, network, asset, amount, destination).
2. CRE (buyer) uses **@x402/fetch** with **`X402_BUYER_EVM_PRIVATE_KEY`** to sign payment and retry with **`PAYMENT-SIGNATURE`**.
3. Server verifies via facilitator, calls OpenAI, returns **200** + **`PAYMENT-RESPONSE`** header (settlement).

CRE = orchestrator; AI Gateway = paid agent. Matches “AI agents consuming CRE workflows with x402 payments.”

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

Example production CRE config: **cre/sentinelflow/config.production.json** (set `aiEndpoint` to your hosted gateway, e.g. `https://YOUR_GATEWAY_DOMAIN/analyze`).
