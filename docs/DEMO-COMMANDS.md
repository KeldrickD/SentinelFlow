# Demo B — Commands to Run (in order)

Run these in order for the 3–5 minute demo. Prerequisites: `cre/.env` and repo root `.env` with keys; for x402 segment, `ai-gateway/.env` with `PAY_TO_ADDRESS`, `OPENAI_API_KEY`, and `X402_BUYER_EVM_PRIVATE_KEY`.

---

## 1. Simulate crash (~5 sec)

```bash
cd cre
cre workflow simulate ./sentinelflow --target staging-settings --non-interactive --trigger-index 0 --http-payload sentinelflow/payload-a.json
```

**Show:** "Workflow compiled" → then crash. Say: *"The local simulator engine crashes on Windows/WSL, so we demonstrate live verifiable execution on Base Sepolia."*

---

## 2. x402 proof (gateway must be running)

**Terminal A — start gateway:**
```bash
cd ai-gateway
npm install
npm start
```

**Terminal B — health then unpaid 402 then paid 200:**

```bash
# Health (establish credibility)
curl http://localhost:8080/health
```

Expect: `x402: true`, `price`, `network: "base-sepolia"`, `payTo`.

```bash
# Unpaid → 402 + PAYMENT-REQUIRED
curl -s -i -X POST http://localhost:8080/analyze -H "Content-Type: application/json" -d "{\"deviationBps\":100,\"riskThreshold\":250,\"pauseThreshold\":700,\"signalType\":\"PRICE_DEVIATION_BPS\",\"executionMode\":\"EXECUTE\"}"
```

Expect: `HTTP/1.1 402`, header `PAYMENT-REQUIRED`.

```bash
# Paid → 200 + PAYMENT-RESPONSE (from repo root or ai-gateway)
cd ai-gateway
DEVIATION_BPS=100 node pay-and-call.js
```

Expect: `Status: 200`, `PAYMENT-RESPONSE (decoded):`, `Body:`, `✅ 200 + PAYMENT-RESPONSE — paid x402 proof complete.`

---

## 3. Onchain execution (from repo root)

```bash
cd c:\dev\SentinelFlow
```

**Send one proof report:**
```powershell
$env:PAYLOAD='{"deviationBps":100,"reason":"demo"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia
```

Copy the printed `txHash`.

**Verify (use the tx hash from above):**
```powershell
$env:TX_HASH='0x...'; npm run verify:base
```

Expect: `Mode: SALT`, `Matches event decisionId: ✅ YES`.

**Export:**
```powershell
$env:TX_HASH='0x...'; npm run export:base
```

Expect: `Determinism: ✅ VERIFIED`. Open `incident_exports\<id>.json` or show Basescan link.

**Basescan link:** `https://sepolia.basescan.org/tx/<TX_HASH>`

---

## 4. Close

Say: *"Policy-first AI-assisted execution engine with monetized agent intelligence (x402) and verifiable onchain enforcement."*

Optional: *"The CRE workflow acts as an orchestration layer between offchain AI intelligence and onchain enforcement, with monetized agent access via x402."*

---

## One-liner reference (after you have a tx hash)

| Step        | Command |
|------------|---------|
| Send proof | `$env:PAYLOAD='{"deviationBps":100,"reason":"demo"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia` |
| Verify     | `$env:TX_HASH='0xYOUR_TX_HASH'; npm run verify:base` |
| Export     | `$env:TX_HASH='0xYOUR_TX_HASH'; npm run export:base` |

---

## Flow verification (run once)

- **Tests:** `npm run test` → 8 passing ✅  
- **Send + verify + export:** Run send, then verify and export with that `TX_HASH` → Mode: SALT ✅, Determinism: ✅ VERIFIED  
- **Gateway:** Requires `ai-gateway/.env`; then `npm start` and the curl + pay-and-call commands above.
