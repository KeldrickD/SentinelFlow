# Demo B — Commands to Run (4-Minute Script)

Run these in order during the demo. **PowerShell** (Windows); for bash, use `export VAR=value` and unquoted strings where shown.

---

## Before you start (one-time)

1. **Env**
   - `cre/.env`: `BASE_SEPOLIA_RPC_URL`, `CRE_ETH_PRIVATE_KEY`
   - `ai-gateway/.env`: `PAY_TO_ADDRESS`, `OPENAI_API_KEY`, `X402_BUYER_EVM_PRIVATE_KEY` (0x optional)

2. **Start the AI gateway** (leave this terminal open):
   ```powershell
   cd ai-gateway
   npm start
   ```
   Wait until you see: `SentinelFlow AI Gateway on port 8080 ...`

---

## 1. CRE layer (0:45 – 1:10) — simulate + crash

```powershell
cd cre
cre workflow simulate ./sentinelflow --target staging-settings --non-interactive --trigger-index 0 --http-payload sentinelflow/payload-a.json
```

- Show “Workflow compiled” ✅ then the engine crash. Say you’re moving to live execution on Base Sepolia.

---

## 2. x402 unpaid — 402 (1:10 – 1:40)

```powershell
curl -s -i -X POST http://localhost:8080/analyze -H "Content-Type: application/json" -d "{\"deviationBps\":100}"
```

- **Narration:** “Unpaid request returns HTTP 402 and PAYMENT-REQUIRED.”  
- *Note:* If you see 200, the middleware may allow the call in your environment; you can still say the gateway is “protected by x402” and show the paid step next.

---

## 3. x402 paid — 200 + settlement (1:40 – 2:10)

```powershell
cd ai-gateway
$env:DEVIATION_BPS='100'; node pay-and-call.js
```

- **Narration:** “With @x402/fetch and an EVM wallet, the buyer pays and retries. We get 200 OK and PAYMENT-RESPONSE confirming settlement.”

---

## 4. Onchain — send proof (2:10 – 2:30)

From **repo root**:

```powershell
cd c:\dev\SentinelFlow
$env:PAYLOAD='{"deviationBps":100,"reason":"salt mode demo"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia
```

- Copy the printed **`txHash`** (e.g. `0x9c0f...a856`).
- Open: **https://sepolia.basescan.org/tx/<txHash>**

---

## 5. Verify determinism (2:30 – 2:50)

```powershell
$env:TX_HASH='0xYOUR_TX_HASH_FROM_STEP_4'
npm run verify:base
```

- Point at: **Mode: SALT** and **Matches event decisionId: ✅ YES**.

---

## 6. Export incident bundle (2:50 – 3:00)

```powershell
$env:TX_HASH='0xYOUR_TX_HASH_FROM_STEP_4'
npm run export:base
```

- Show: **Exported incident bundle: ... incident_exports\...json** and **Determinism: ✅ VERIFIED**.

---

## 7. Guardrails + close (3:00 – 4:00)

- Narration only (no commands): DEESCALATE_ONLY guardrail, AI can only reduce risk; then scroll README Judges section and close.

---

## Quick reference (paste order)

| Step | Command |
|------|--------|
| Start gateway | `cd ai-gateway; npm start` (keep running) |
| CRE simulate | `cd cre; cre workflow simulate ./sentinelflow --target staging-settings --non-interactive --trigger-index 0 --http-payload sentinelflow/payload-a.json` |
| Unpaid 402 | `curl -s -i -X POST http://localhost:8080/analyze -H "Content-Type: application/json" -d "{\"deviationBps\":100}"` |
| Paid x402 | `cd ai-gateway; $env:DEVIATION_BPS='100'; node pay-and-call.js` |
| Send proof | `cd c:\dev\SentinelFlow; $env:PAYLOAD='{"deviationBps":100,"reason":"salt mode demo"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia` |
| Verify | `$env:TX_HASH='0x...'; npm run verify:base` |
| Export | `$env:TX_HASH='0x...'; npm run export:base` |

Replace `0x...` in verify/export with the `txHash` from the send-proof step.
