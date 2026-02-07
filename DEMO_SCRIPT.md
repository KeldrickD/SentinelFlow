# SentinelFlow — 2–3 Minute Demo Script

Use this order and talking points for a short video. Total ~2–3 minutes.

---

## 1. Intro (15–20 sec)

**Screen:** README or repo root.

**Say:**  
“SentinelFlow is an autonomous onchain operations engine built with Chainlink CRE. Offchain workflows evaluate risk signals and submit a single report onchain. A receiver contract validates the report, logs every decision for auditability, and conditionally executes safe controls like risk-mode and pause. I’ll show the architecture, the contracts on Base Sepolia, and four proof transactions.”

---

## 2. Architecture (20–30 sec)

**Screen:** README “Architecture” section or a simple diagram.

**Say:**  
“CRE is the brain: it gets a payload like deviation-in-basis-points and reason, applies policy with two thresholds—risk and pause—and builds one report. Only a trusted forwarder can call the receiver. The receiver always logs to the DecisionJournal and, when the report says so, calls OpsTarget to set risk mode or pause. OpsTarget is only callable by the receiver, so there’s a single trust boundary. We also enforce a cooldown so we don’t flap on repeated triggers.”

---

## 3. Contracts on Base Sepolia (20–25 sec)

**Screen:** Basescan links from README (Receiver, OpsTarget, DecisionJournal).

**Say:**  
“Everything is deployed on Base Sepolia. Here’s the SentinelFlowReceiver, the OpsTarget it controls, and the DecisionJournal. The receiver’s constructor shows the forwarder, the ops target, the journal, and the cooldown in seconds.”

*(Optional: open Receiver contract tab and scroll to constructor args.)*

---

## 4. Proof transactions (60–75 sec)

**Screen:** README “Live Demo Proof” table or DEMO.md. Open each tx on Basescan in turn.

**Say:**  
“I ran four proof payloads.  
**A:** Deviation 100 bps, below threshold—one tx, only DecisionLogged, no state change.  
**B:** Deviation 300 bps—DecisionLogged and RiskModeUpdated; risk mode is now 2.  
**C:** Deviation 900 bps—DecisionLogged and Paused; OpsTarget is paused.  
**D:** Same as B again within 60 seconds—the receiver logged the decision but with actionType COOLDOWN_BLOCKED and did not change state again. So we get journal plus tiered response plus cooldown in one flow.”

*(Show Logs on one tx: DecisionLogged and, for B or C, RiskModeUpdated or Paused.)*

---

## 5. Wrap (15–20 sec)

**Screen:** README or SUBMISSION.md.

**Say:**  
“So we have end-to-end: signal in, policy in CRE, one report onchain, receiver validates and logs, and conditionally runs risk-mode or pause with cooldown. Repo has README, DEMO.md, and scripts to reproduce. Thanks.”

---

## Checklist before recording

- [ ] README “Live Demo Proof” section has correct links.
- [ ] Tabs ready: Receiver, OpsTarget, Journal, and the four proof tx pages on Basescan.
- [ ] Optional: run `scripts/status.ts` once to show current paused/riskMode.
