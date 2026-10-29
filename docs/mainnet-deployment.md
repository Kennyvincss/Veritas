# VERITAS — Arc Mainnet Deployment Guide

> **IMPORTANT:** Arc Mainnet transactions involve real USDC and are irreversible.
> Complete all testnet testing, an independent security audit, and the pre-deployment checklist before proceeding.

---

## Arc Mainnet Network Details

Verified from [docs.arc.io](https://docs.arc.io):

| Property | Value |
|---|---|
| Chain ID | `5042` |
| RPC URL | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| USDC address | `0x3600000000000000000000000000000000000000` |
| USDC decimals (ERC-20) | 6 |
| Gas token | USDC (same asset, 18-decimal native view) |

---

## Pre-Deployment Checklist

Complete **every item** before deploying:

### Security
- [ ] Stage 6 security audit reviewed — no Critical or High issues remain unresolved
- [ ] HIGH-4 (localStorage submission trust) reviewed and accepted or mitigated for mainnet
- [ ] An independent, professional Solidity audit has been completed and findings addressed
- [ ] All 39 Foundry unit tests pass (`bun run contracts:test`)
- [ ] `bun run check` passes (0 lint errors, 0 type errors)

### Contract
- [ ] Contract source (`contracts/VeritasEscrow.sol`) has not been modified since the last test run
- [ ] `forge build` produces a fresh artifact at `contracts/out/VeritasEscrow.sol/VeritasEscrow.json`
- [ ] Constructor arg verified: USDC = `0x3600000000000000000000000000000000000000`
- [ ] Chain ID guard in deploy script will abort if `--rpc-url` points to wrong network

### Wallet and Funds
- [ ] Deployer wallet is a hardware wallet or encrypted keystore — NOT a plaintext private key in any file
- [ ] Deployer wallet address confirmed and recorded
- [ ] Deployer wallet has sufficient USDC for gas (Arc mainnet gas is USDC — contact Circle for mainnet gas USDC if needed)
- [ ] Deployer wallet has **never** been used for testnet operations with the same key

### Frontend
- [ ] `VITE_ESCROW_ADDRESS_MAINNET` is ready to be set (do NOT set before deployment)
- [ ] `.env` is in `.gitignore` — never commit it
- [ ] `VITE_ESCROW_ADDRESS` (testnet) is preserved and unchanged

---

## Deployment Steps

### Step 1: Build the contract

```bash
cd /path/to/veritas
forge build
```

Verify artifact exists: `contracts/out/VeritasEscrow.sol/VeritasEscrow.json`

### Step 2: Import your deployer key into an encrypted keystore

**Never pass a private key as a CLI flag or store it in a file.**

```bash
cast wallet import mainnet-deployer --interactive
# Prompts for private key + passphrase — key is stored encrypted locally
```

### Step 3: Dry-run (simulation, no broadcast)

```bash
forge script contracts/script/DeployVeritasMainnet.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --account mainnet-deployer \
  -vvvv
```

Verify the output:
- Chain ID shown: `5042`
- USDC address: `0x3600000000000000000000000000000000000000`
- Deployer address matches your expected wallet
- No errors

### Step 4: Deploy (with broadcast)

```bash
forge script contracts/script/DeployVeritasMainnet.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --account mainnet-deployer \
  --broadcast \
  -vvvv
```

**Record the output immediately:**
- Deployed contract address
- Deployment transaction hash
- Block number
- Explorer URL

### Step 5: Verify the deployment on-chain

```bash
# Verify USDC token address stored in contract
cast call <DEPLOYED_ADDRESS> "getUsdcToken()(address)" \
  --rpc-url https://rpc.mainnet.arc.io
# Expected: 0x3600000000000000000000000000000000000000

# Verify bountyCount is 0 (fresh deploy)
cast call <DEPLOYED_ADDRESS> "bountyCount()(uint256)" \
  --rpc-url https://rpc.mainnet.arc.io
# Expected: 0

# Verify contract code exists at address
cast code <DEPLOYED_ADDRESS> --rpc-url https://rpc.mainnet.arc.io
# Expected: non-empty bytecode
```

Check the explorer: `https://explorer.arc.io/address/<DEPLOYED_ADDRESS>`

### Step 6: Wire the frontend

Add to `.env` (never commit):

```
VITE_ESCROW_ADDRESS_MAINNET=<DEPLOYED_ADDRESS>
```

Rebuild and test:

```bash
bun install
bun run build
# Serve the build locally and verify the mainnet contract reads work
```

### Step 7: Post-deployment verification

- [ ] `getUsdcToken()` returns `0x3600000000000000000000000000000000000000`
- [ ] `bountyCount()` returns `0`
- [ ] Explorer confirms contract creation tx
- [ ] Frontend in production build connects to mainnet contract when wallet is on chain ID 5042
- [ ] "Arc Mainnet" warning banner visible when connected on mainnet
- [ ] "Contract not deployed" banner does NOT appear
- [ ] Testnet still works when wallet is on chain ID 5042002

---

## Environment Variables

| Variable | Purpose | Notes |
|---|---|---|
| `VITE_ESCROW_ADDRESS` | Testnet escrow address | Set; do not change |
| `VITE_ESCROW_ADDRESS_MAINNET` | Mainnet escrow address | Set after deployment |

Never set `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, or private keys in `.env` for a production build.

---

## Contract Addresses

| Network | Address | Explorer |
|---|---|---|
| Arc Testnet | `0xeb9ceb841559b47dd62b51a77f7d9767c76e1779` | [View](https://explorer.testnet.arc.io/address/0xeb9ceb841559b47dd62b51a77f7d9767c76e1779) |
| Arc Mainnet | **Not yet deployed** — set `VITE_ESCROW_ADDRESS_MAINNET` after deployment | — |

---

## Known Limitations Before Mainnet

1. **HIGH-4 (Stage 6):** Submission contributor addresses are stored in unsigned localStorage. A malicious script with origin access could modify the stored address before the owner calls `approveContributor`. The contract enforces payment to the approved address, but the owner UI trusts the localStorage record to select who to approve. Mitigation: owners should manually verify the contributor's wallet address matches their off-platform communication before approving.

2. **Submission metadata is local-only:** Bounty titles and descriptions survive on the device that created the bounty. Contributors on different devices see "Bounty #N (description not available)" for bounties whose metadata was not shared. A production deployment should migrate to a shared metadata store (IPFS, a simple database, or a signing-based solution).

3. **No source verification:** The Arc Mainnet explorer may not support automated source verification. Manually publish the contract source and ABI alongside any public launch.

---

## Security Notes

- The deployed contract on Arc Testnet (`0xeb9ceb841559b47dd62b51a77f7d9767c76e1779`) was reviewed by a dual auditor (rule-corpus + functional) and returned zero findings. The same contract is deployed to mainnet unchanged.
- An independent professional audit is strongly recommended before significant funds are held in escrow.
- The contract has no upgrade mechanism. If a critical bug is discovered, the only remediation is to deploy a new contract and migrate users.
