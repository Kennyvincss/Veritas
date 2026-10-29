# Stage 6 Security Report — VERITAS

**Date:** 2026-10-26  
**Scope:** Stages 1–5 — contract, frontend hooks, submission storage, approval and payment flows  
**Network:** Arc Testnet (Chain ID 5042002) — testnet only; no mainnet involvement

---

## 1. Methodology

- Full source read of all contract and frontend files
- Dual audit pass: rule-corpus (Solidity patterns) and functional (end-to-end adversary model)
- Manual code review of all hooks, components, and storage helpers
- Foundry test suite execution with added security regression tests
- Dependency audit via `bun pm ls` cross-referenced against known CVEs

**Clearly stated:** This is an internal developer review. It is NOT a professional third-party audit. VERITAS must receive an independent professional security audit before any mainnet deployment or handling of real funds.

---

## 2. Findings

### HIGH-1 — No resume path when tab closes between `approveContributor` and `releasePayment`

**Status: FIXED**

**Description:** The approval flow sends two separate transactions. If the user closes the tab or loses connectivity after `approveContributor` confirms but before `releasePayment` is sent, the bounty is stuck in `Approved` state onchain. The normal UI hides the Approve button once a submission is locally marked `approved`, and the hook always restarts from step 1 (which now reverts because the bounty is already `Approved`).

**Fix applied:** Added `useReleasePayment` hook (single-step, calls only `releasePayment`) and a "Resume — Release Payment" recovery banner in `BountyDetailPage`. The banner appears when: `bounty.status === 'in_review'` (Approved onchain) + `bounty.approvedContributor` is set + no submission is locally marked `paid`. The resume path is driven entirely from onchain state, not localStorage.

---

### HIGH-2 — `Created` bounties presented as `'open'` and accepting submissions

**Status: FIXED**

**Description:** The `toFrontendStatus` function in `useOnchainBounties` previously mapped both `CONTRACT_STATUS.Created` and `CONTRACT_STATUS.Funded` to `'open'`. A bounty in `Created` state has no USDC in escrow. Contributors could submit work to a bounty that may never be funded, and the bounty owner could solicit work before committing funds.

**Fix applied:** `CONTRACT_STATUS.Created` now maps to `'draft'`. The `BountyDetailPage` blocks submissions when `bounty.status === 'draft'` with an explicit message: "This bounty has not yet been funded." `StatusBadge` shows "Awaiting Funding" for draft bounties. The `BountyMeta` type docs updated.

---

### HIGH-3 — `javascript:` (and other unsafe) URL schemes allowed in deliverable links

**Status: FIXED**

**Description:** `new URL(d.url)` accepts `javascript:`, `data:`, `blob:`, and other non-HTTP schemes. These values were stored in localStorage and rendered as `<a href=...>` — clickable links that execute script in the browser context.

**Fix applied:**
- `useSubmissions.submit()`: URL validation now enforces `ALLOWED_SCHEMES = new Set(['https:', 'http:'])`. Any other scheme returns an error before storage.
- `BountyDetailPage.renderDeliverables()`: added a defence-in-depth render guard that skips any link whose parsed protocol is not `https:` or `http:`, even if it somehow reached storage.

---

### HIGH-4 — Submission `contributor` address sourced from mutable localStorage (design limitation)

**Status: DOCUMENTED — not fully mitigated at this stage**

**Description:** When the bounty owner clicks "Approve & Release Payment", the contributor address passed to `approveContributor()` is read from the submission record in localStorage. Any script running in the same origin, or a user with developer tools access, can modify localStorage to substitute an attacker-controlled address as the `contributor`, causing the payout to land on the wrong wallet.

**Partial mitigation applied:** The approval confirmation dialog now shows:
- The full contributor address in a `mono` block for manual verification.
- An explicit warning: "Verify the contributor address above before confirming. Submission data is stored locally — confirm the address matches the contributor you intended to reward."

**Note:** The smart contract enforces that `releasePayment` sends funds to `bounty.approvedContributor` — the address set during `approveContributor()`. The contract cannot be tricked into paying a different address after approval. The attack requires the owner to sign `approveContributor(bountyId, attackerAddress)` — which requires the owner's wallet signature. The risk is social-engineering the owner into signing with a tampered address, not a silent fund drain.

**Full mitigation (out of scope for Stage 6):** EIP-712 signed submissions, or a trusted backend/onchain submission index, would eliminate the dependency on unsigned localStorage data for the payout recipient.

---

## 3. Contract Security Analysis

**No critical or high findings in the contract itself.**

The contract was reviewed against the following attack surfaces:

| Check | Result |
|---|---|
| Reentrancy on `releasePayment` | Protected by `ReentrancyGuard` — tested (HIGH-1 security test pass) |
| Reentrancy on `cancelBounty` | Protected by `ReentrancyGuard` — tested |
| Reentrancy on `fundBounty` | Protected by `ReentrancyGuard` — tested |
| Double payout (pay twice) | State machine prevents — `Paid` status blocks second `releasePayment` |
| Self-approval (owner = contributor) | `OwnerCannotBeContributor` error — tested |
| Unauthorized `approveContributor` | `NotBountyOwner` check — tested |
| Unauthorized `releasePayment` | `NotBountyOwner` check — tested |
| Unauthorized `cancelBounty` | `NotBountyOwner` check — tested |
| Cancel after paid | `InvalidStatus` error blocks it — tested |
| Payment to wrong address | `releasePayment` reads `bounty.approvedContributor` from storage — fuzz test confirms correctness |
| Integer overflow | Solidity 0.8.28 built-in overflow protection |
| Zero reward | `ZeroAmount` error |
| Zero address contributor | `ZeroAddress` error |
| Deadline in past | `DeadlineInPast` error |
| `block.timestamp` manipulation | Informational — deadline check is `>`, not `>=`; tolerance is acceptable for bounty use case |
| Fund-lock scenario | `Created` bounties can be cancelled only from `Funded`/`Approved`; a `Created`-only bounty with no `fundBounty` call cannot be cancelled. **See MEDIUM-1 below.** |
| SafeERC20 usage | All token transfers use `safeTransfer`/`safeTransferFrom` |
| Constructor zero address | Validated |

---

### MEDIUM-1 — `Created` bounty with no `fundBounty` call cannot be cancelled (fund-lock is impossible, but UX gap exists)

**Status: DOCUMENTED — no contract change required**

**Description:** A bounty in `Created` state holds no USDC — there is nothing to refund. `cancelBounty` correctly rejects `Created` state. However, if a user creates a bounty (gas spent) and then decides not to fund it, they cannot "clean up" the record onchain. The bounty record stays in `Created` state indefinitely. This is not a fund-lock (no USDC is at risk) but it is a UX limitation.

**Recommendation:** A future contract upgrade could add a `discardBounty(bountyId)` function limited to `Created` state. Not required for Stage 6.

---

### LOW-1 — `createdAt` is approximated from `deadline - 30 days`

**Status: DOCUMENTED**

The contract does not store a creation timestamp. `useOnchainBounties` approximates `createdAt` as `deadline - 30 * 86400`. This affects the "Newest" sort in the marketplace and is clearly inaccurate. For a future improvement, store a creation timestamp in the contract or index `BountyCreated` event timestamps.

---

### LOW-2 — `bounties` public mapping exposed without enumeration function

**Status: DOCUMENTED**

`bounties(id)` is public but there is no `getBounties(from, to)` pagination function. The frontend reads `bountyCount` then fetches each bounty individually (N+1 calls). This does not cause incorrect state but adds per-bounty latency. A batch getter would be more efficient at scale.

---

## 4. Dependency Audit

All runtime dependencies are current pinned versions. Checked:

| Package | Version | Notes |
|---|---|---|
| `viem` | 2.57.5 | No known CVEs |
| `wagmi` | ^2.19.5 | No known CVEs |
| `@openzeppelin/contracts` | 5.6.1 | No known CVEs |
| `connectkit` | 1.9.2 | No known CVEs |
| `@tanstack/react-query` | ^5.104.5 | No known CVEs |
| `react` | ^18.3.1 | No known CVEs |

No `bun audit` command was available. Manual version review found no packages with known critical CVEs.

---

## 5. Tests Executed

### Foundry — 39 tests total, 39 passed, 0 failed

**Original suite (27 tests — VeritasEscrow.t.sol):** all pass  
**New security regression suite (12 tests — VeritasEscrowSecurity.t.sol):** all pass

New tests added:
1. `testReentrancy_releasePayment` — reentrancy guard blocks double-payout via malicious ERC-20
2. `testReentrancy_cancelBounty` — reentrancy guard blocks double-refund
3. `testReentrancy_fundBounty` — reentrancy guard on fundBounty
4. `testFundBounty_insufficientAllowance` — SafeERC20 reverts on zero allowance
5. `testGetBounty_outOfRange` — BountyNotFound for id > bountyCount
6. `testApproveContributor_alreadyApproved` — double-approve reverts InvalidStatus
7. `testReleasePayment_paysStoredContributor` — payout lands on approvedContributor, not owner or third party
8. `testMultiBounty_accounting` — releasing one bounty does not alter another's balance
9. `testFuzz_payout_alwaysGoesToApprovedContributor(address)` — 256 fuzz runs; payout always correct
10. `testCancelBounty_approvedContributorCannotCancel` — contributor cannot cancel
11. `testApproveContributor_contributorCannotApproveSelf` — contributor cannot approve self
12. `testReleasePayment_requiresApprovedState` — Funded status blocks releasePayment

### Frontend — lint and typecheck

- oxlint: 0 errors, 0 warnings
- tsc: 0 errors

---

## 6. Arc Testnet Verification

- Contract address: `0xeb9ceb841559b47dd62b51a77f7d9767c76e1779`
- Chain ID: 5042002 (Arc Testnet)
- USDC: `0x3600000000000000000000000000000000000000` (6 decimals)
- ABI in `src/contracts/VeritasEscrow.ts` matches the deployed contract
- `VITE_ESCROW_ADDRESS` in `.env` matches deployed address
- Explorer: `https://explorer.testnet.arc.io/address/0xeb9ceb841559b47dd62b51a77f7d9767c76e1779`

**No redeployment is required.** All Stage 6 changes are frontend-only.

---

## 7. Remaining Risks and Checks Required Before Any Mainnet Deployment

1. **Independent professional audit** — mandatory before mainnet. This report is an internal developer review only.
2. **HIGH-4 (localStorage trust)** — implement EIP-712 signed submissions or a trusted backend submission index before mainnet.
3. **MEDIUM-1 (Created bounty cleanup)** — consider a `discardBounty` function.
4. **LOW-1 (createdAt approximation)** — store creation timestamp in contract for accurate sorting.
5. **LOW-2 (N+1 fetching)** — add a batch getter function for production scale.
6. **Formal verification** — consider Certora or Halmos for the state machine invariants.
7. **Oracle / price feed** — not applicable (USDC-denominated fixed rewards).
8. **Emergency pause / upgrade mechanism** — contract is not upgradeable; any critical bug requires full redeployment and user migration.
9. **Mainnet USDC address** — must be updated from testnet address before any mainnet deploy.
10. **Bug bounty program** — recommended before public launch.

---

## 8. Stages 1–5 Regression

All Stage 1–5 functionality was preserved:
- Wallet connection and network detection: unchanged
- Bounty creation (3-step: approve → createBounty → fundBounty): unchanged
- Escrow funding: unchanged
- Marketplace listing with filters: unchanged; `draft` status added without breaking existing filters
- Work submission form and localStorage persistence: unchanged; URL validation strengthened
- Creator review panel (offchain status updates): unchanged
- Approval and payment (2-step onchain): unchanged; resume path added
- Cancel and refund: unchanged
- Contributor dashboard: unchanged

---

*VERITAS has not been independently or professionally audited. This report covers an internal developer security review only.*
