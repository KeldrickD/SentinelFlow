# SentinelFlow — Hackathon Submission

## One-liner

SentinelFlow is an autonomous onchain operations engine built with Chainlink CRE: offchain workflows evaluate risk signals, submit a single structured report onchain, and a receiver contract validates, logs every decision, and conditionally executes safe controls (risk-mode, pause) with cooldown and tiered response.

## Short description (for forms)

SentinelFlow replaces bots and manual ops with deterministic, rule-based automation. A Chainlink CRE workflow accepts risk signals (e.g. price deviation in bps), applies configurable thresholds, and sends one report to a receiver contract on Base Sepolia. The receiver enforces a single trust boundary: it validates the report, always logs to an append-only DecisionJournal for auditability, and conditionally executes SET_RISK_MODE or PAUSE on a protected OpsTarget. Cooldown per policy prevents flapping; two-tier thresholds (risk vs pause) show tiered incident response. All proof txs and explorer links are in the repo README and DEMO.md.

## Technical detail

- **CRE (offchain):** Policy logic lives in TypeScript (config: `deviationBpsThreshold`, `pauseBpsThreshold`). One report tuple is built and sent onchain (no direct CRE→OpsTarget coupling).
- **SentinelFlowReceiver:** Accepts calls only from a trusted forwarder (EOA or contract). Decodes report; always logs to DecisionJournal; routes actionType (NO_ACTION | SET_RISK_MODE | PAUSE); uses low-level calls so journal logging never reverts; enforces cooldown per policyId so repeated triggers within 60s log COOLDOWN_BLOCKED and skip execution.
- **OpsTarget:** Only the receiver can call `setRiskMode(uint8)` and `pause()`. Clean separation: CRE never touches OpsTarget directly.
- **DecisionJournal:** Append-only; every decision (including NO_ACTION and COOLDOWN_BLOCKED) is logged with decisionId, policyId, signalType, signalValue, actionType, success, reason, timestamp.
- **Deployment:** Base Sepolia with Hardhat; config written to `cre/sentinelflow/config.staging.json`. Proof transactions generated via `scripts/send-proof-report.ts` (same report encoding as CRE would send).

## What’s next

- Full CRE project (project.yaml + HTTP trigger + EVM write capability) so `cre workflow simulate` runs end-to-end in the CLI.
- Configurable cooldown and risk-mode value via report or config.
- Additional signal types and actions (e.g. cap adjustments, circuit breakers).
