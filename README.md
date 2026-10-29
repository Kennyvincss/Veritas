# VERITAS — Onchain Bounty Platform

VERITAS lets project owners create USDC-backed work bounties on the Arc blockchain, receive submissions from contributors, and release payment automatically through an escrow smart contract when work is approved.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Fonts**: Space Grotesk, DM Sans, JetBrains Mono
- **Auth**: Privy (Google, email, wallet login)
- **Web3**: wagmi v2, viem v2
- **Smart Contracts**: Solidity 0.8.28, Foundry
- **Chain**: Arc Testnet (Chain ID: 5042002)
- **Token**: USDC (`0x3600000000000000000000000000000000000000`)

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.x
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- An EVM-compatible browser wallet (MetaMask etc.)

### Install

```bash
bun install
```

### Run

```bash
bun run dev
```

### Build

```bash
bunx vite build
```

### Smart Contracts

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
```

### Lint & Typecheck

```bash
bun run check
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_PRIVY_APP_ID` | Privy App ID — enables Google/email login. Get one free at [dashboard.privy.io](https://dashboard.privy.io) |
| `VITE_AI_SERVER_URL` | URL of the deployed AI backend (e.g. Railway). Leave empty in dev — Vite proxies to localhost:3001 automatically. |
| `ANTHROPIC_API_KEY` | Anthropic API key for the AI evaluator backend (server-side only, never in the browser) |
| `VITE_ESCROW_ADDRESS` | Deployed VeritasEscrow contract address on Arc Testnet (set automatically after deploy) |

`RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS` — provisioned automatically by Arc Studio; optional outside Arc Studio (app falls back to the public Arc Testnet RPC).

## Network

All testnet. No real funds.

| Property | Value |
|---|---|
| Chain | Arc Testnet |
| Chain ID | 5042002 |
| RPC | https://rpc.testnet.arc.io |
| Explorer | https://explorer.testnet.arc.io |
| USDC | `0x3600000000000000000000000000000000000000` |

## What Users Can Do

- Browse live bounties read directly from the escrow smart contract
- Connect an EVM wallet (MetaMask or similar) on Arc Testnet
- Post a bounty: fill the form, approve USDC, sign two transactions, and see the funded bounty live in the marketplace
- View full bounty details with reward, deadline, creator profile, and block explorer links
- Submit work against an open bounty (title, summary, up to 8 deliverable URLs)
- Approve a submission and release USDC escrow in two onchain transactions
- Cancel a bounty and recover USDC when no work has been approved yet
- View a dashboard of bounties posted, submissions made, and receipts earned
- Receive a tamper-evident work receipt (SHA-256 integrity hash) after payment
- Verify a receipt's onchain proof independently (PaymentReleased event + contract state)
- Request an AI evaluation of a submission before approving (advisory only, no onchain action)
- View and edit a public profile with display name, bio, avatar, and skills
- Browse the contributor leaderboard ranked by payments earned
- Share a receipt with a public verification link

## AI Evaluator

Set `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) and start the AI backend with `bun run server` before using the evaluation panel. The panel shows "not configured" when no key is set. The AI never approves payments or issues receipts — it produces a human-readable advisory report only.

## Status

**Stage 8 complete** — contract deployed at `0xeb9ceb841559b47dd62b51a77f7d9767c76e1779` (Arc Testnet). All workflows wired to the chain, receipt system, onchain verification, AI evaluator, profile/reputation system, and mobile-first UI all polished and tested.
