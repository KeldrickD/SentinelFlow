# Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart contracts** | Solidity 0.8.20, Hardhat, OpenZeppelin |
| **Chain** | Base Sepolia |
| **CRE workflow** | TypeScript, Bun, @chainlink/cre-sdk, viem |
| **AI** | OpenAI API (gpt-4o-mini), OpenAI-compatible interface |
| **AI Gateway** | Node.js, Express |
| **Signals** | HTTP payload; optional Chainlink Price Feed (PRICE_FEED mode) |
| **Tooling** | Hardhat scripts (status, health, decisions, runbook, verify-tx, export-incident), CRE CLI |

## Key Dependencies

- **cre/sentinelflow**: @chainlink/cre-sdk, viem
- **Root**: hardhat, @openzeppelin/contracts, dotenv
- **ai-gateway**: express

## External Services

- **Base Sepolia RPC** — e.g. sepolia.base.org or Alchemy/Infura
- **OpenAI API** — for aiMode=LLM and AI Gateway
- **Chainlink Price Feed** — Base Sepolia ETH/USD (optional, for PRICE_FEED signal mode)
