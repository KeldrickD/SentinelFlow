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

**If local simulate crashes** (WASM engine “subscribe” trap in v1.2.0), use **live deployment** instead — it satisfies the requirement “simulation or live deployment on the CRE network.” See [Option: Live deployment (CRE network)](#option-live-deployment-cre-network) below.

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

## Option: Live deployment (CRE network)

If **local simulate** fails (e.g. “subscribe” WASM trap in CRE CLI v1.2.0), the requirement *“successful simulation or live deployment on the CRE network”* can be met by **deploying** the workflow to the CRE network. Deploy uses the same **compile** step (no local engine run), then uploads artifacts and registers on the Workflow Registry contract.

### Get it working (checklist)

Deployment is in **early access**: Chainlink must grant your org access before deploy will succeed. Do this once:

| Step | What to do | Who does it |
|------|------------|-------------|
| **0. Request access** | In a terminal, run `cre account access`. When prompted, choose **Yes**, then briefly describe your use case (e.g. “SentinelFlow risk automation for hackathon”). Submit the request. | You (one-time) |
| **1. Get approved** | Chainlink will email you when deployment access is enabled for your organization. | Chainlink |
| **2. Mainnet ETH** | The wallet in `.env` (`CRE_ETH_PRIVATE_KEY`) must have **Ethereum mainnet** ETH for gas (link-key + deploy + activate all send mainnet txs). | You |
| **3. Run deploy script** | From `cre/`: `chmod +x cre-deploy.sh && ./cre-deploy.sh ../.env` (or `./cre-deploy.sh /mnt/c/dev/SentinelFlow/.env` in WSL). This runs link-key → deploy → activate. | You (after access + ETH) |

Until Step 1 is done, `cre workflow deploy` and `cre account link-key` will exit with: *“Workflow deployment is currently in early access … Run 'cre account access' to request access.”*

### 1. Check deployment access

```bash
cre account access
```

Choose **Yes** when asked “Request deployment access?” (one-time). If access is not yet enabled for your organization, you must complete this step before deploy will proceed.

### 2. Deploy the workflow

**One command (after access is granted and wallet has mainnet ETH):**

```bash
./cre-deploy.sh ../.env
```

(WSL from repo on Linux FS: `./cre-deploy.sh /mnt/c/dev/SentinelFlow/.env`)

Or run the steps manually. From **this directory** (`cre/`), with Linux Bun on `PATH` (WSL: `export PATH=$HOME/.bun/bin:$HOME/.cre/bin:$PATH`):

```bash
cre workflow deploy ./sentinelflow --target staging-settings
```

Use `--yes` to skip confirmation. Compilation runs locally; artifacts are uploaded and the workflow is registered onchain.

### 3. Activate the workflow

```bash
cre workflow activate ./sentinelflow --target staging-settings
```

### 4. Trigger and show execution

After deploy + activate, trigger the workflow (per CRE docs for your target) and capture logs + onchain tx + incident bundle for the demo.

**CLI reference:** `cre --help`, `cre workflow --help`, `cre workflow deploy --help`, `cre account access --help`.

**Note:** Deploy requires an RPC for `ethereum-mainnet` (Workflow Registry is on mainnet). `project.yaml` and `sentinelflow/workflow.yaml` include a public mainnet RPC; replace with your own if needed. You also need a funded Ethereum mainnet wallet (for gas) and deployment access granted via `cre account access`.

## Workflow features

- **Config validation** — Fail-fast if receiver or thresholds are invalid.
- **Deterministic decisionId** — Replay-safe IDs (receiver + policyId + signal + action + timestamp).
- **Incident bundle** — Each run can write `sentinelflow/incidents/<decisionId>.json` (input, signal, thresholds, action, AI suggestion, createdAt). Omitted if the runtime has no filesystem.
- **AI advisor (stub)** — AI suggests severity and recommended action; the **policy engine** computes max action, then a **guardrail** applies (e.g. `DEESCALATE_ONLY`). The suggestion is included in the response and in the `reason` string logged onchain. **aiMode**: `STUB` (default, rules-based), `LLM` (OpenAI; set `OPENAI_API_KEY` in `cre/.env`), or `GATEWAY` (call `config.aiEndpoint`, e.g. x402-paid AI Gateway). **aiPolicy**: `DEESCALATE_ONLY` (AI can only de-escalate or match policy) or `ADVISORY_ONLY` (policy action is always executed; AI is logged only).
- **PRICE_FEED mode** — In `config.staging.json` set `"signalMode": "PRICE_FEED"` and provide `feedAddressEthUsd` (Base Sepolia ETH/USD) and `baselinePriceUsd` (8 decimals). The workflow then reads the Chainlink feed and computes deviation in bps instead of using HTTP payload. Keep `"signalMode": "HTTP"` for demos with manual payloads.
- **executionMode: DRY_RUN | EXECUTE** — If `"executionMode": "DRY_RUN"`, the workflow still computes the action and writes the incident bundle (including `actionTypeComputed`, `shadowAction`), but the report is sent with `actionType: "NO_ACTION"` so nothing is executed onchain. Use for “monitor in prod without acting.”

- **Policy manifest + policyHash** — Policy files in `sentinelflow/policies/` (e.g. `policy.v0.json`); workflow computes `policyHash = keccak256(canonicalJson(policy))` and includes it in meta, incident bundle, and response. Set `config.policyVersion` (default `"v0"`) to load another policy file.

## Windows: paths with spaces

If your project path has spaces (e.g. `...\Keldrick Dickey\...`), the CRE SDK’s compile step can fail. This repo **patches** `node_modules/@chainlink/cre-sdk` so that:

- `mkdir(..., { recursive: true })` ignores **EEXIST** (directory already exists).
- **Bun shell** calls are replaced with **spawn** so paths with spaces are passed correctly.

Patched sources are in `sentinelflow/patches/cre-sdk/`. After every `bun install`, `postinstall` runs `scripts/apply-cre-patches.cjs`, which copies these into `node_modules/@chainlink/cre-sdk/`, so simulate keeps working on Windows even after reinstalls.

## CRE simulate: WASM engine crash

If you see **"Failed to create engine: wasm trap: wasm \`unreachable\` instruction executed"** after "Workflow compiled", the failure is in the **CRE CLI simulator** (it compiles to WebAssembly and runs locally; see [Chainlink: Simulating Workflows](https://docs.chain.link/cre/guides/operations/simulating-workflows)). The crash happens during **subscribe** in the simulator’s WASM engine, before your workflow runs. On Windows this is an environment/runtime issue, not your workflow code. **Don’t switch to Foundry**—Hardhat isn’t the problem.

**For a reliable path:** follow **WSL2: one clean simulate** below. Don’t burn more time on Windows native simulate.

**Check CRE is installed:** `cre version`. If an update is available, run `cre update` (on Windows you may need to manually replace the binary under `%LOCALAPPDATA%\Programs\cre\cre.exe` with the downloaded exe).

### Do this next (Windows), in this order

**1) Move the repo to a path with no spaces**

Paths like `...\Keldrick Dickey\...` often trigger WASM/toolchain issues on Windows.

- Copy or clone the repo to: **`C:\dev\SentinelFlow`**
- Open a **new** terminal (PowerShell or CMD)
- Run:

```powershell
cd C:\dev\SentinelFlow\cre
cre workflow simulate sentinelflow --target staging-settings --trigger-index 0 --http-payload sentinelflow/payload-a.json
```

(Try without `--non-interactive` first to reduce edge-case flags.)

**2) Use Windows Terminal + PowerShell, not Git Bash**

Git Bash path translation can cause subtle WASM runtime issues.

**3) Try WSL2 (recommended fallback)**

If native Windows keeps crashing:

- Install WSL2 + Ubuntu
- Put the repo on the Linux filesystem (e.g. `~/dev/SentinelFlow`), **not** under `/mnt/c/...`
- Install CRE inside WSL (same version)
- Run the same simulate command

WSL avoids many Windows-specific WASM/runtime issues.

**4) If it still crashes**

Treat it as a CRE CLI simulator bug on your Windows setup. Use **WSL** for the one successful simulation you need for the hackathon video—don’t fight the native engine.

### Game plan for judges

- **Onchain proof** — `send-proof-report.ts` (works today).
- **x402 proof** — AI Gateway returns 402 + PAYMENT-REQUIRED (works today).
- **CRE proof** — Get **one** successful `cre workflow simulate` run (using the steps above), record it (screenshot/terminal clip), then freeze.

## WSL2: one clean simulate (for submission)

When native Windows simulate crashes in the WASM engine, use WSL2 for the single run required for the CRE & AI track.

**Step 0 — Key rule:** Do **not** run from `/mnt/c/...`. Put the repo on the **Linux filesystem**: `~/dev/SentinelFlow`.

### 1. Install WSL2 + Ubuntu (if needed)

In PowerShell (Admin):

```powershell
wsl --install -d Ubuntu
```

Reboot if prompted, then open **Ubuntu**.

### 2. Workspace in Ubuntu

```bash
mkdir -p ~/dev
cd ~/dev
```

### 3. Clone or copy repo into Linux FS

**Option A — Clone from GitHub:**

```bash
git clone https://github.com/KeldrickD/SentinelFlow.git SentinelFlow
cd SentinelFlow/cre
```

**Option B — Copy from Windows:** zip the repo on Windows, move the zip into your Ubuntu home (e.g. via Windows Explorer `\\wsl$\Ubuntu\home\<user>\`), then in Ubuntu:

```bash
cd ~/dev
unzip ~/SentinelFlow.zip -d SentinelFlow
cd SentinelFlow/cre
```

### 4. Install CRE CLI in WSL (Linux)

Follow [Chainlink: Installing the CRE CLI on Linux](https://docs.chain.link/cre/getting-started/cli-installation/linux). Then confirm:

```bash
export PATH=$HOME/.cre/bin:$PATH   # add to ~/.bashrc to make permanent
cre version
```

**One-time login (required before simulate):** Run `cre login` in WSL and complete the browser flow. After that, simulate can run non-interactively.

### 5. Install Bun (Linux) in WSL — required for compile

The workflow compile step **must** use **Linux Bun**, not Windows Bun. If your WSL `which bun` points to a Windows path (e.g. `/mnt/c/...`), the compile will fail with UNC path errors.

Install Bun on the Linux side:

```bash
sudo apt-get install -y unzip
curl -fsSL https://bun.sh/install | bash
export PATH=$HOME/.bun/bin:$PATH   # add to ~/.bashrc to make permanent
bun --version
```

### 6. One-time: Javy plugin + workflow deps

From `~/dev/SentinelFlow/cre`:

```bash
cd sentinelflow
bun install
bun x cre-setup
cd ..
```

If `bun x cre-setup` fails (e.g. "cre-setup not found"), build the Javy plugin manually (Javy is already cached after first compile attempt):

```bash
cd ~/dev/SentinelFlow/cre/sentinelflow
~/.cache/javy/v5.0.4/linux-x64/javy init-plugin \
  node_modules/@chainlink/cre-sdk-javy-plugin/dist/javy_chainlink_sdk.wasm \
  -o node_modules/@chainlink/cre-sdk-javy-plugin/dist/javy-chainlink-sdk.plugin.wasm
cd ../..
```

### 7. Run simulate

**Interactive** (choose HTTP trigger, paste payload when prompted):

```bash
cre workflow simulate ./sentinelflow --target staging-settings
```

**Non-interactive** (after you know it works):

```bash
cre workflow simulate ./sentinelflow --target staging-settings --non-interactive --trigger-index 0 --http-payload sentinelflow/payload-a.json
```

Or use the helper script (after one-time `cre login`): `./run-simulate-wsl.sh` (defaults to `payload-a.json`; pass another path as first arg). If the script is missing, pull the latest from the repo or create it — see `run-simulate-wsl.sh` in the repo.

**All-in-one (after Linux Bun + CRE CLI + `cre login`):** `./wsl-setup-and-simulate.sh` — builds the Javy plugin if missing, then runs simulate.

### 8. Record proof for judges

Record a short clip showing: the simulate command, workflow runs successfully, output includes AI mode (and if using gateway, x402-paid call completing). That clip satisfies the “successful simulation via CRE CLI” requirement.

### 9. Video line (optional but recommended)

In the demo video, say:

> “CRE simulate on Windows native currently crashes in the local WASM engine during subscribe. We run the official CRE CLI simulation in WSL2 (Linux) for a clean run.”

## Note on onchain writes

This workflow runs the **policy logic** (thresholds → actionType) in CRE. To actually send the report onchain to your receiver, use either:

- **`scripts/send-proof-report.ts`** from repo root (sends from your EOA; receiver must have that address as forwarder), or
- **CRE with `--broadcast`** once your receiver is deployed with the Chainlink Mock Forwarder / Keystone Forwarder for Base Sepolia (see [Forwarder Directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory)).
