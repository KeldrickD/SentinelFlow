# SentinelFlow CRE Project

Minimal CRE project so `cre workflow simulate sentinelflow` runs from the CLI.

## Prerequisites

- **CRE CLI** installed and logged in: `cre version`, `cre login`
- **Bun** 1.2.21+ (required for TypeScript workflows): [bun.sh](https://bun.sh)

## Setup (one-time)

1. **From this directory (`cre/`):**

   ```bash
   cd sentinelflow
   bun install
   cd ..
   ```

   Or from repo root:

   ```bash
   bun install --cwd cre/sentinelflow
   ```

2. **`.env`** in `cre/`: set `CRE_ETH_PRIVATE_KEY` (64 hex, no `0x`) and `BASE_SEPOLIA_RPC_URL` if you use `--broadcast`.

## Run simulation

From **this directory** (`cre/`), not repo root:

```bash
cre workflow simulate sentinelflow --target staging-settings
```

When prompted:

1. Select the **HTTP Trigger**.
2. Enter JSON payload, e.g.:
   - No action: `{"deviationBps": 100, "reason": "within band"}`
   - Risk mode: `{"deviationBps": 300, "reason": "price feed drift"}`
   - Pause: `{"deviationBps": 900, "reason": "extreme move"}`

You should see "Workflow compiled", then logs with `actionType`, and a "Workflow Simulation Result" JSON.

**Non-interactive** (use a payload file so the CLI doesn’t split the JSON). From `cre/`:

```bash
cre workflow simulate ./sentinelflow -T=staging-settings --non-interactive --trigger-index 0 --http-payload payload-a.json
```

Payload files in `sentinelflow/`: `payload-a.json` (NO_ACTION), `payload-b.json` (SET_RISK_MODE), `payload-c.json` (PAUSE). Path is relative to the **workflow folder** when you pass a filename like `payload-a.json`.

## Workflow features

- **Config validation** — Fail-fast if receiver or thresholds are invalid.
- **Deterministic decisionId** — Replay-safe IDs (receiver + policyId + signal + action + timestamp).
- **Incident bundle** — Each run can write `sentinelflow/incidents/<decisionId>.json` (input, signal, thresholds, action, AI suggestion, createdAt). Omitted if the runtime has no filesystem.
- **AI advisor (stub)** — AI suggests severity and recommended action; the **policy engine is final**. The suggestion is included in the response and in the `reason` string logged onchain (e.g. `... | AI: SET_RISK_MODE | severity=HIGH | conf=0.8`). Stub is deterministic; swap with a real LLM behind the same interface later.
- **PRICE_FEED mode** — In `config.staging.json` set `"signalMode": "PRICE_FEED"` and provide `feedAddressEthUsd` (Base Sepolia ETH/USD) and `baselinePriceUsd` (8 decimals). The workflow then reads the Chainlink feed and computes deviation in bps instead of using HTTP payload. Keep `"signalMode": "HTTP"` for demos with manual payloads.
- **executionMode: DRY_RUN | EXECUTE** — If `"executionMode": "DRY_RUN"`, the workflow still computes the action and writes the incident bundle (including `actionTypeComputed`, `shadowAction`), but the report is sent with `actionType: "NO_ACTION"` so nothing is executed onchain. Use for “monitor in prod without acting.”

- **Policy manifest + policyHash** — Policy files in `sentinelflow/policies/` (e.g. `policy.v0.json`); workflow computes `policyHash = keccak256(canonicalJson(policy))` and includes it in meta, incident bundle, and response. Set `config.policyVersion` (default `"v0"`) to load another policy file.

## Windows: paths with spaces

If your project path has spaces (e.g. `...\Keldrick Dickey\...`), the CRE SDK’s compile step can fail. This repo **patches** `node_modules/@chainlink/cre-sdk` so that:

- `mkdir(..., { recursive: true })` ignores **EEXIST** (directory already exists).
- **Bun shell** calls are replaced with **spawn** so paths with spaces are passed correctly.

Patched sources are in `sentinelflow/patches/cre-sdk/`. After every `bun install`, `postinstall` runs `scripts/apply-cre-patches.cjs`, which copies these into `node_modules/@chainlink/cre-sdk/`, so simulate keeps working on Windows even after reinstalls.

## Note on onchain writes

This workflow runs the **policy logic** (thresholds → actionType) in CRE. To actually send the report onchain to your receiver, use either:

- **`scripts/send-proof-report.ts`** from repo root (sends from your EOA; receiver must have that address as forwarder), or
- **CRE with `--broadcast`** once your receiver is deployed with the Chainlink Mock Forwarder / Keystone Forwarder for Base Sepolia (see [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)).
