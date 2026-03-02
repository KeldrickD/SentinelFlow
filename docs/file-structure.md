# File Structure

```
SentinelFlow/
├── contracts/
│   ├── IDecisionJournal.sol
│   ├── IOpsTarget.sol
│   ├── DecisionJournal.sol
│   ├── OpsTarget.sol
│   ├── SentinelFlowReceiver.sol
│   └── MockForwarder.sol
├── scripts/
│   ├── deploy.ts
│   ├── status.ts
│   ├── health.ts
│   ├── decisions.ts
│   ├── ops-runbook.ts
│   ├── verify-tx.ts
│   ├── export-incident.ts
│   ├── send-proof-report.ts
│   └── show-address.ts
├── test/
│   └── SentinelFlowReceiver.spec.ts
├── cre/
│   ├── project.yaml
│   ├── .env.example
│   ├── README.md
│   └── sentinelflow/
│       ├── main.ts           # CRE workflow entry
│       ├── aiAdvisor.ts      # Stub AI
│       ├── aiLLM.ts          # OpenAI + guardrail
│       ├── workflow.yaml
│       ├── config.staging.json
│       ├── config.production.json
│       ├── policies/
│       │   └── policy.v0.json
│       ├── incidents/        # Written at runtime
│       ├── payload-a.json, payload-b.json, payload-c.json
│       ├── scripts/
│       │   └── apply-cre-patches.cjs
│       └── patches/cre-sdk/  # Windows patches
├── ai-gateway/
│   ├── server.js             # x402 /analyze endpoint
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── docs/
│   ├── project_plan.md
│   ├── prd.md
│   ├── backend-structure.md
│   ├── tech-stack.md
│   ├── APIs.md
│   ├── app-flow.md
│   ├── file-structure.md
│   └── frontend-guidelines.md
├── hardhat.config.ts
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── DEMO.md
├── SUBMISSION.md
└── DEMO_SCRIPT.md
```

## Chainlink-using files (for README link requirement)

- `cre/sentinelflow/main.ts` — CRE workflow (CRE SDK, Runner, HTTP trigger)
- `cre/sentinelflow/workflow.yaml` — CRE workflow config
- `cre/project.yaml` — CRE project targets
- `cre/sentinelflow/aiLLM.ts` — Optional LLM call used by workflow
- Contracts interact with chain; scripts use Hardhat/ethers for Base Sepolia.
