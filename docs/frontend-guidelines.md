# Frontend Guidelines (Optional)

If a UI is added later (out of scope for current hackathon):

1. **Do not allow direct onchain execution** — All decisions must pass through the CRE workflow or the send-proof-report path with the same encoding and validation.
2. **Display policy and auditability** — Show `policyHash`, `decisionId`, and link to Basescan for DecisionLogged events.
3. **DRY_RUN vs EXECUTE** — Make it explicit when the user is in DRY_RUN (shadow action only) vs EXECUTE (onchain).
4. **AI suggestion** — Display AI recommendation, confidence, and guardrail result (actionTypeComputed vs actionTypeAfterGuardrail vs actionTypeExecuted) so users see the full chain.
5. **Secrets** — Never expose `CRE_ETH_PRIVATE_KEY` or `OPENAI_API_KEY` in the frontend; keep all keys server-side or in CRE/env only.

## Current Scope

No frontend is required for submission. CRE CLI simulation and Hardhat scripts are sufficient for the 3–5 minute demo.
