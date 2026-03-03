# Demo Script B — If deployment access is NOT approved

Use this flow when CRE deployment access is still pending or you are not using mainnet. You still demonstrate full workflow behavior without the CRE CLI simulator or deploy.

## 1. Show simulate crash (5 seconds)

Run:

```bash
cd cre
cre workflow simulate ./sentinelflow --target staging-settings --non-interactive --trigger-index 0 --http-payload sentinelflow/payload-a.json
```

- Show **“Workflow compiled”** ✅.
- Show the crash: **“Failed to create engine … wasm \`unreachable\` instruction executed”** (known CRE CLI v1.2.0 engine bug on our environment).

Say one sentence:

> “The local CRE simulator currently crashes during engine subscribe in v1.2.0. The workflow compiles successfully, and we demonstrate execution using onchain proof transactions plus x402-paid AI agent calls.”

## 2. Show x402 paid AI flow

- Start the AI gateway (see `ai-gateway/README.md`).
- Call `POST /analyze` **without** payment → show **402** and **PAYMENT-REQUIRED** header.
- Show CRE (or a client) using **@x402/fetch** with payment → **200** and **PAYMENT-RESPONSE**.
- Emphasize: paid AI agent, standards-compliant, economic realism.

## 3. Show onchain proof

From repo root:

```bash
PAYLOAD='{"deviationBps":100,"reason":"golden demo"}' npx hardhat run scripts/send-proof-report.ts --network baseSepolia
```

Copy the printed `txHash`. Then:

```bash
TX_HASH=<txHash> npm run verify:base
TX_HASH=<txHash> npm run export:base
```

- Show **verify** output (DecisionLogged decoded, **Mode: SALT**, **Matches event decisionId: ✅ YES**).
- Show **export** → `incident_exports/<decisionId>.json` and **Determinism: ✅ VERIFIED**.

## 4. Golden proof link

Point to README **“Proof tx (verifies ✅)”** and the Basescan link. New proof txs use **salt-mode** so verify shows **Mode: SALT** and **✅ YES** (no timestamp mismatch).

## 5. Recap for video

- CRE workflow **compiles**; local simulate hits known engine crash.
- **x402**: 402 → pay → 200 + PAYMENT-RESPONSE (monetized AI).
- **Onchain**: send-proof-report → Basescan tx → verify + export.
- **Positioning:** “Policy-first AI-assisted execution engine with monetized agent intelligence (x402) and verifiable onchain enforcement.”

**Optional closing line:**  
“The CRE workflow acts as an orchestration layer between offchain AI intelligence and onchain enforcement, with monetized agent access via x402.”

---

## Pre-recording checklist (do once before recording)

| # | Check | Command / action |
|---|--------|-------------------|
| 1 | Gateway health | `curl http://localhost:8080/health` → `x402: true`, `price`, `network: "base-sepolia"`, `payTo` |
| 2 | Unpaid 402 | `curl -s -i -X POST http://localhost:8080/analyze -H "Content-Type: application/json" -d "{\"deviationBps\":100,\"riskThreshold\":250,\"pauseThreshold\":700,\"signalType\":\"PRICE_DEVIATION_BPS\",\"executionMode\":\"EXECUTE\"}"` → HTTP 402, `PAYMENT-REQUIRED` header |
| 3 | Paid flow | `DEVIATION_BPS=100 node pay-and-call.js` → Status 200, PAYMENT-RESPONSE (decoded), Body, ✅ line |
| 4 | Salt-mode verify | `TX_HASH=<golden_tx> npm run verify:base` → Mode: SALT, ✅ YES; `npm run export:base` → Determinism: ✅ VERIFIED |
| 5 | Judges quick links | Scroll README top: golden proof, Demo A/B, x402 commands, Chainlink files |

---

**Prerequisites:** `cre login` (for compile), Base Sepolia env and deployed contracts, optional AI gateway running for x402 segment. No mainnet ETH or deployment access required.
