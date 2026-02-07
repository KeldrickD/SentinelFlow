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

## Setup

### Environment

Copy the example env files and fill in secrets (do not commit `.env`):

- **Repo root** (for deploy): copy `.env.example` to `.env` and set `DEPLOYER_PRIVATE_KEY`, `FORWARDER_ADDRESS`, etc.
- **CRE** (for simulate): copy `cre/.env.example` to `cre/.env` and set `CRE_ETH_PRIVATE_KEY` (64 hex, no `0x`). This key must be funded on Base Sepolia.

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

Or use package scripts: `npm run status:base`, `npm run health:base`, `npm run decisions:base`. Health prints a JSON verdict (OK/WARN/ALERT), last decision, and a suggested next step. To verify a tx’s DecisionLogged determinism: `TX_HASH=0x... npx hardhat run scripts/verify-tx.ts --network baseSepolia` (or `npm run verify:base` with `TX_HASH` set). Ops runbook: `npm run runbook:base`. Export incident to JSON: `TX_HASH=0x... npm run export:base`. Defaults use the deployed addresses above; override with env vars.

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
