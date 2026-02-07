# SentinelFlow — Demo Walkthrough

Reproduce the Base Sepolia demo in under 20 minutes.

## Prerequisites

- Node.js, npm, Hardhat (`npm install` then `npx hardhat compile`)
- CRE CLI installed (`cre version`) and logged in (`cre login`)
- Funded deployer key on Base Sepolia
- `FORWARDER_ADDRESS` (CRE forwarder) for deploy

**Env files:** Copy `.env.example` to `.env` in repo root; copy `cre/.env.example` to `cre/.env` and fill in `CRE_ETH_PRIVATE_KEY` (funded on Base Sepolia).

## 1. Deploy

```bash
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export FORWARDER_ADDRESS=0x...
export UPDATE_CRE_CONFIG=1
export COOLDOWN_SECONDS=60
npx hardhat run scripts/deploy.ts --network baseSepolia
```

Save the printed **SentinelFlowReceiver**, **OpsTarget**, and **DecisionJournal** addresses.

## 2a. CRE CLI simulate (optional)

From **cre/** directory (not repo root):

```bash
cd cre
bun install --cwd sentinelflow   # or: cd sentinelflow && bun install
cre login
cre workflow simulate sentinelflow --target staging-settings
```

Select the HTTP trigger and paste a payload (A/B/C below). For onchain proof txs use **2b** (script) or add `--broadcast` once the receiver uses the Chainlink forwarder for your network. See **cre/README.md**.

## 2b. Send proof reports (same as CRE output)

From repo root, with `cre/.env` containing `CRE_ETH_PRIVATE_KEY` and `BASE_SEPOLIA_RPC_URL`:

```powershell
# A) NO_ACTION
$env:PAYLOAD = '{"deviationBps": 100, "reason": "within band"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia

# B) SET_RISK_MODE
$env:PAYLOAD = '{"deviationBps": 300, "reason": "price feed drift"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia

# C) PAUSE
$env:PAYLOAD = '{"deviationBps": 900, "reason": "extreme move"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia

# D) COOLDOWN_BLOCKED (run B again within 60s)
$env:PAYLOAD = '{"deviationBps": 300, "reason": "repeat within cooldown"}'; npx hardhat run scripts/send-proof-report.ts --network baseSepolia
```

Each run prints `actionType`, `txHash`, and `blockNumber`. On Basescan, open the tx and check **Logs** for `DecisionLogged` (and for B/C, `RiskModeUpdated` / `Paused`).

**Alternative (CRE CLI):** If you have a full CRE project (`project.yaml` + workflow with HTTP trigger and chain write), run from `cre/`: `cre login` then `cre workflow simulate sentinelflow --target staging-settings` and paste the same payloads when prompted.

## 3. Payloads reference

**Payload A (no action)** — only DecisionJournal logs:

```json
{ "deviationBps": 100, "reason": "within band" }
```

**Payload B (risk mode)** — DecisionJournal + OpsTarget risk mode → 2:

```json
{ "deviationBps": 300, "reason": "price feed drift" }
```

**Payload C (pause)** — DecisionJournal + OpsTarget paused:

```json
{ "deviationBps": 900, "reason": "extreme move" }
```

## 4. What to show on Base Sepolia explorer

- **A** ([tx](https://sepolia.basescan.org/tx/0x2c78889ab0101566c76e3443a2c1086ddc0e9e7eeea19657874feaa215db93a8)): `DecisionLogged` only; OpsTarget unchanged.
- **B** ([tx](https://sepolia.basescan.org/tx/0x1e7cac106628b8b52016beebfe0a5662e94ee573d434f5457ef50778411af2fd)): `DecisionLogged` + `RiskModeUpdated`; `riskMode() == 2`.
- **C** ([tx](https://sepolia.basescan.org/tx/0xe05f1255585c23fe961cfe50bae4fc976779f6715d0c4e8186d530557c1f280a)): `DecisionLogged` + `Paused`; `paused() == true`.
- **D** ([tx](https://sepolia.basescan.org/tx/0xfff48f9e2e96ce505341a9061188aa7e153170f10d45fe7e55bb8d8e99f0ca77)): `DecisionLogged` with `actionType` = COOLDOWN_BLOCKED; no state change.

## 5. Cooldown (optional)

Send Payload B twice within 60 seconds. Second tx should log `DecisionLogged` with actionType `COOLDOWN_BLOCKED` and not change OpsTarget again.

## Read state (optional)

```bash
npx hardhat run scripts/status.ts --network baseSepolia
LIMIT=10 npx hardhat run scripts/decisions.ts --network baseSepolia
```

Status shows executor, paused, riskMode; decisions shows last N `DecisionLogged` events (e.g. COOLDOWN_BLOCKED).

## Troubleshooting

| Issue | Check |
|-------|--------|
| RPC errors | `BASE_SEPOLIA_RPC_URL` and network in Hardhat config |
| Out of gas | Fund deployer / CRE key on Base Sepolia |
| Invalid sender | Receiver only accepts calls from `FORWARDER_ADDRESS` (CRE forwarder) |
| Wrong forwarder | Redeploy with correct `FORWARDER_ADDRESS` and set OpsTarget executor to new receiver |
