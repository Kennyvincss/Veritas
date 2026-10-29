# VERITAS — Project Memory

> Built with Arc Studio — money-powered apps in minutes

## What This App Does

VERITAS is an onchain bounty and payment platform on Arc Testnet. Project owners create bounties backed by USDC escrow. Contributors submit work. Owners approve the best submission and the escrow releases USDC directly to the contributor. Every payment is a verifiable Arc blockchain transaction.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Fonts: Space Grotesk (display), DM Sans (body), JetBrains Mono (mono)
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Build: `bun run contracts:build`. Test: `bun run contracts:test`.
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC ERC-20 at `0x3600000000000000000000000000000000000000` (6 decimals)
  - On Arc, native gas IS USDC (18 decimals). Never sum native + ERC-20 balances.
- Explorer: https://explorer.testnet.arc.io
- RPC: https://rpc.testnet.arc.io
- Toasts: Sonner

## Arc Testnet Network Config (verified from onchain-facts registry)

| Property | Value | Source |
|---|---|---|
| Chain ID | 5042002 | `onchain-facts.ts` |
| RPC | https://rpc.testnet.arc.io | `onchain-facts.ts` |
| Explorer | https://explorer.testnet.arc.io | `onchain-facts.ts` |
| USDC address | `0x3600000000000000000000000000000000000000` | `onchain-facts.ts` |
| USDC decimals (ERC-20) | 6 | `onchain-facts.ts` |
| Native USDC decimals | 18 | `onchain-facts.ts` |
| SCP blockchain enum | ARC-TESTNET | `onchain-facts.ts` |
| CCTP domain | 26 | `onchain-facts.ts` |

## Key Files

```
src/
  App.tsx                       — routing shell, demo data clearly labelled
  types/bounty.ts               — Bounty, Submission, BountyStatus, SubmissionStatus, WorkReceipt, ReceiptVerificationStatus
  lib/utils.ts                  — formatAddress, formatUsdcAmount, timeRemaining, etc.
  lib/share.ts                  — getShareBase / buildShareLink helper
  components/
    NavBar.tsx                  — sticky nav with ConnectKit wallet button
    LandingPage.tsx             — hero, how-it-works, features sections
    MarketplacePage.tsx         — filtered bounty grid
    CreateBountyPage.tsx        — bounty creation form (Stage 2: escrow wiring)
    BountyDetailPage.tsx        — detail view + submission form
    DashboardPage.tsx           — owner + contributor dashboard
    BountyCard.tsx              — reusable bounty card component
    StatusBadge.tsx             — BountyStatusBadge, SubmissionStatusBadge
contracts/
  (empty — escrow contract to be written in Stage 2)
```

## Contract Deployments

None yet. The escrow contract is implemented in Stage 2.

## Stage Tracker

### Stage 1 — COMPLETE
- [x] Environment inspection
- [x] Arc Testnet network config verified
- [x] Application foundation and routing shell
- [x] Landing page, marketplace, create form, detail page, dashboard
- [x] Domain types: Bounty, Submission, BountyStatus, SubmissionStatus
- [x] Utility functions using @/onchain-money and @/onchain-facts
- [x] Arc Dark design tokens applied throughout
- [x] Space Grotesk / DM Sans / JetBrains Mono fonts loaded
- [x] Demo data clearly labelled — no simulated transactions
- [x] Lint and typecheck passing

### Stage 7 — Mainnet Preparation COMPLETE (deployment pending — must be run by user)
- Arc Mainnet: Chain ID 5042, RPC https://rpc.mainnet.arc.io, Explorer https://explorer.arc.io
- USDC: same predeploy address on mainnet and testnet (0x3600000000000000000000000000000000000000, 6 dec)
- Deploy script: contracts/script/DeployVeritasMainnet.s.sol (chain ID guard, sanity checks, deployment log)
- Frontend: already dual-chain — useArcNetwork detects mainnet vs testnet; getEscrowAddress returns undefined until VITE_ESCROW_ADDRESS_MAINNET is set
- NetworkBanner: shows "not yet deployed" warning on mainnet before env var is set; shows live "real funds" reminder after deployment
- FIXED: stale ESCROW_ADDRESS reference in useCreateAndFundBounty (was deprecated constant; now uses local escrowAddress)
- FIXED: refetchBalance type in useArcNetwork (was () => void, should be () => unknown to match wagmi's Promise return)
- 39/39 Foundry tests pass, 0 lint errors, 0 tsc errors
- Deployment guide: docs/mainnet-deployment.md
- Mainnet VeritasEscrow address: NOT YET DEPLOYED — add VITE_ESCROW_ADDRESS_MAINNET to .env after running the script

### UI Retheme — COMPLETE: CityPay-inspired Light Mode
- Canvas: soft lavender-grey (#e8eaf6), white cards with shadow
- Accent: dark navy (#1a2e4a) — Arc Light palette
- Sidebar icon nav (desktop) + bottom nav (mobile) replacing top nav
- ConnectKit set to light mode
- StatusBadge: light-mode Tailwind colour classes (slate/emerald/amber/blue/red)
- All dark-mode rgba hardcodes replaced with CSS vars and light-mode equivalents
- oxlint: 0 errors, tsc: 0 errors

### Stage 6 — COMPLETE: Security Auditing and Comprehensive Testing
- [x] Dual audit: rule-corpus + functional — 4 High findings identified
- [x] HIGH-1 FIXED: No resume path if tab closed between approveContributor + releasePayment → `useReleasePayment` hook + resume banner in `BountyDetailPage`
- [x] HIGH-2 FIXED: Created (unfunded) bounties shown as 'open' → mapped to 'draft', blocked from accepting submissions
- [x] HIGH-3 FIXED: javascript:/data: URLs in deliverable links (XSS) → scheme allowlist in `useSubmissions` + render guard in `BountyDetailPage`
- [x] HIGH-4 DOCUMENTED: localStorage contributor address trusted for approveContributor — warning added to approval dialog; full fix requires EIP-712 or backend (future stage)
- [x] MEDIUM-1 DOCUMENTED: Created bounty cannot be cancelled (no funds at risk; UX gap)
- [x] New security regression test suite: `contracts/test/VeritasEscrowSecurity.t.sol` — 12 tests
- [x] Foundry: 39/39 pass (27 original + 12 new security tests)
- [x] oxlint: 0 errors, tsc: 0 errors
- [x] No contract changes — no redeployment required
- [x] Dependency audit: no known CVEs in pinned versions
- [x] Report: `docs/stage-6-security-report.md`
- New files: `contracts/test/VeritasEscrowSecurity.t.sol`
- Modified: `src/types/bounty.ts` (draft status), `src/hooks/useOnchainBounties.ts` (draft mapping + approvedContributor), `src/hooks/useSubmissions.ts` (URL scheme allowlist), `src/hooks/useApproveAndPay.ts` (useReleasePayment export), `src/components/BountyDetailPage.tsx` (draft guard + resume banner + render guard + warning), `src/components/StatusBadge.tsx` (draft badge)

### Stage 5 — COMPLETE: Review, Approval & Contributor Payments
- [x] `src/types/bounty.ts` — `SubmissionStatus` expanded: `approved` (approveContributor confirmed), `paid` (releasePayment confirmed)
- [x] `src/hooks/useSubmissions.ts` — `markApproved(id)` + `markPaid(id, txHash)` methods added
- [x] `src/hooks/useApproveAndPay.ts` — 2-step onchain flow: approveContributor → releasePayment, each receipt-confirmed before advancing; callbacks fire to update localStorage
- [x] `src/hooks/useCancelBounty.ts` — single-tx cancelBounty flow with confirm dialog
- [x] `src/components/StatusBadge.tsx` — `paid` badge (bright emerald, onchain-backed)
- [x] `src/components/BountyDetailPage.tsx` — Approve & Release Payment button; pre-approval confirmation dialog (bounty, contributor, reward, irreversibility warning); 2-step progress banner with tx explorer links; Cancel Bounty button + dialog; contributor paid-status panel with payout tx link; sonner toasts
- [x] oxlint: 0 errors, tsc: 0 errors
- [x] Foundry: 27/27 pass (contract unchanged — no redeployment needed)
- [x] Report: `docs/stage-5-report.md`
- Contract functions used: `approveContributor`, `releasePayment`, `cancelBounty` (all existing, all owner-only, all enforced by contract)

### Stage 4 — COMPLETE: Work Submission System
- [x] `src/types/bounty.ts` — expanded: `DeliverableLink`, 5-state `SubmissionStatus`, `Submission.title/deliverables/updatedAt/creatorNote`
- [x] `src/hooks/useSubmissions.ts` — localStorage CRUD, duplicate guard, owner-only status updates, cross-tab sync
- [x] `src/components/StatusBadge.tsx` — `under_review`, `revision_requested` badges added
- [x] `src/components/BountyCard.tsx` — `hasMySubmission` "Submitted" badge
- [x] `src/components/MarketplacePage.tsx` — sort controls: Newest, Highest Reward, Deadline Soon, My Submissions
- [x] `src/components/BountyDetailPage.tsx` — full submission form (title + description + up to 8 deliverable links); confirm screen; creator review panel (mark under review, request revision, reject with note); expand/collapse submissions
- [x] `src/components/DashboardPage.tsx` — contributor submissions panel; submission count on owner bounty cards; deliverable chips; creator note display
- [x] `src/App.tsx` — `useSubmissions` integrated; `submissions` + `submissionsApi` passed to all pages
- [x] oxlint: 0 errors, tsc: 0 errors
- [x] Foundry: 27/27 pass (contract unchanged)
- [x] Report: `docs/stage-4-report.md`
- Storage: localStorage (`veritas_submissions_v1`). No contract changes.

### Stage 3 — COMPLETE: Bounty Creation & Funding
- [x] Deploy VeritasEscrow to Arc Testnet: `0xeb9ceb841559b47dd62b51a77f7d9767c76e1779`
- [x] `VITE_ESCROW_ADDRESS` added to `.env`
- [x] `src/contracts/VeritasEscrow.ts` — ABI + address config
- [x] `src/hooks/useOnchainBounties.ts` — live bounty reads from contract (bountyCount + getBounty)
- [x] `src/hooks/useCreateAndFundBounty.ts` — 3-step flow: approve → createBounty → fundBounty
- [x] `src/hooks/useArcTestnet.ts` — wallet/chain validation + USDC balance
- [x] CreateBountyPage wired to real contract; shows per-step progress and tx explorer links
- [x] MarketplacePage reads live bounties, has loading skeleton, error banner, refresh button
- [x] BountyDetailPage shows onchain data with explorer links
- [x] App.tsx replaced DEMO_BOUNTIES with useOnchainBounties
- [x] Frontend lint + typecheck: clean (0 errors)
- [x] Foundry unit tests: 27/27 pass

### Stage 2 — COMPLETE: Escrow Smart Contract
- [x] Write `contracts/VeritasEscrow.sol` (Solidity 0.8.28, OpenZeppelin 5.6.1)
  - createBounty(contentHash, rewardAmount, deadline) → bountyId
  - fundBounty(bountyId) — safeTransferFrom owner → contract
  - approveContributor(bountyId, contributor) — designate winner
  - releasePayment(bountyId) — safeTransfer to approvedContributor
  - cancelBounty(bountyId) — refund to owner (Funded/Approved only)
  - getBounty(bountyId) → Bounty struct
  - getUsdcToken() → address
- [x] Balanced security review — both auditors — ZERO findings
- [x] Slither static analysis — 1 informational (block.timestamp, expected/acceptable)
- [x] 27 Foundry unit tests — ALL PASS (0 failures, 0 skipped)
  - Test files: contracts/test/VeritasEscrow.t.sol, contracts/test/VeritasEscrow.Base.t.sol
- [x] Arc Testnet RPC added to foundry.toml (arc_testnet)
- [ ] Deploy to Arc Testnet via deploy_contract tool (Stage 3)
- [ ] Wire frontend: replace DEMO_BOUNTIES with useReadContract reads
- [ ] CreateBountyPage: USDC approve + fundBounty write flow
- [ ] BountyDetailPage: approveContributor write + releasePayment write
- [ ] Show real tx hashes and explorer links

### Contract Deployments
| Contract | Network | Address | Tx Hash | Explorer |
|---|---|---|---|---|
| VeritasEscrow | Arc Testnet | `0xeb9ceb841559b47dd62b51a77f7d9767c76e1779` | `0x4f585782da303b03157db1c00c3d50a85fe83d3d97017a02ea297c75d4677f68` | [View](https://explorer.testnet.arc.io/address/0xeb9ceb841559b47dd62b51a77f7d9767c76e1779) |

USDC constructor arg: `0x3600000000000000000000000000000000000000` (Arc Testnet ERC-20 USDC, 6 decimals)

## Decisions

- **Arc Dark mode**: chosen over Arc Light because VERITAS is a work/payments platform, not a consumer game or wallet — dense data, multiple roles, professional tone.
- **In-memory routing**: single-page state machine in App.tsx for Stage 1 — no react-router dependency added yet. Can be upgraded to react-router in Stage 2 for deep linking.
- **Demo data not onchain**: all DEMO_BOUNTIES and DEMO_SUBMISSIONS are clearly labelled in code. No fake transactions, hashes, or progress states.
- **escrow amounts as bigint**: all reward amounts stored as raw ERC-20 units (6 decimal USDC bigint) from day one to prevent decimal-conversion bugs when the contract is wired.
