# App Flow

```
Signal (HTTP or PRICE_FEED)
    │
    ▼
CRE Workflow (main.ts)
    │
    ├─► Config validation
    ├─► Load policy → policyHash
    ├─► deviationBps (from body or Chainlink feed)
    ├─► computeAction(deviationBps, config)  →  actionType (policy)
    │
    ├─► AI suggestion
    │     ├─► STUB   → aiSuggest()
    │     ├─► LLM    → aiSuggestLLM() [OpenAI]
    │     └─► GATEWAY → fetch(aiEndpoint) [x402-paid]
    │
    ├─► applyGuardrail(actionType, ai.recommendedAction, aiPolicy)  →  actionAfterGuardrail
    │
    ├─► ExecutionMode
    │     ├─► DRY_RUN && actionAfterGuardrail !== NO_ACTION
    │     │     → shadowAction = actionAfterGuardrail, finalActionType = NO_ACTION
    │     └─► else  → finalActionType = actionAfterGuardrail
    │
    ├─► decisionId, incident bundle (policyHash, ai, actionTypeComputed, actionTypeAfterGuardrail, actionTypeExecuted)
    │
    └─► Response JSON
          │
          ▼
    (Optional) Onchain
          │
          ├─► send-proof-report.ts  or  CRE --broadcast
          │     → encode report → receiver.onReport(0x, encoded)
          │
          ├─► SentinelFlowReceiver
          │     ├─► validate sender (forwarder)
          │     ├─► cooldown check
          │     ├─► journal.logDecision(...)
          │     └─► ops.setRiskMode() / ops.pause() when action !== NO_ACTION
          │
          └─► DecisionJournal (event) + OpsTarget (state)
```

## Key Invariants

- **Policy** always computes the maximum allowed action; **guardrail** ensures the executed action never exceeds that.
- **DRY_RUN** never changes onchain state; incident bundle records the shadow action.
- **Deterministic decisionId** enables verify-tx and export-incident to recompute and validate.
