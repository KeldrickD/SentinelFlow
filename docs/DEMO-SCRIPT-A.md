# Demo Script A — If deployment access is approved

Use this flow when Chainlink has granted CRE deployment access and you have mainnet ETH for gas.

## 1. Deploy workflow to CRE network

From repo root (WSL or terminal with CRE CLI + Bun on PATH):

```bash
cd cre
./cre-deploy.sh ../.env
```

Or step by step:

```bash
cd cre
cre account link-key --owner-label "SentinelFlow" --yes -e ../.env
cre workflow deploy ./sentinelflow --target staging-settings --yes -e ../.env
cre workflow activate ./sentinelflow --target staging-settings --yes -e ../.env
```

## 2. Trigger workflow (HTTP)

Per CRE docs for your target: trigger the deployed workflow with an HTTP payload (e.g. `{"deviationBps": 100, "reason": "demo"}`).

## 3. Show onchain result

- Open Basescan (or the chain explorer for your target) and show the resulting transaction.
- Optional: run `TX_HASH=<txHash> npm run verify:base` and `TX_HASH=<txHash> npm run export:base` from repo root to show determinism check and incident export.

## 4. Recap for video

- CRE workflow **deployed** and **activated** on the CRE network.
- HTTP trigger → workflow run → onchain tx.
- Verify ✅ and export incident bundle.

---

**Prerequisites:** Deployment access granted, mainnet ETH for link-key + deploy + activate, `cre login` done, `.env` has `CRE_ETH_PRIVATE_KEY` (and mainnet RPC in `cre/project.yaml` / `cre/sentinelflow/workflow.yaml`).
