# VERITAS — Stage 7: Integration & Security Report

## Summary

All major workflows are connected, permissions and data integrity have been checked, six confirmed issues have been fixed, 20 new integration tests were added, and all existing functionality remains intact.

**Test results:** 115/115 pass (5 test files). 0 lint errors. 0 type errors.

---

## Issues Found and Fixed

### 1. Hardcoded testnet explorer URL in BountyDetailPage
**File:** `src/components/BountyDetailPage.tsx`
**Finding:** Module-level `const EXPLORER = 'https://explorer.testnet.arc.io'` and `ARC_TESTNET_CHAIN_ID` used in three `formatUsdcAmount` calls — both hardcoded to testnet regardless of the user's actual connected network. On mainnet, transaction links would point to the wrong explorer and reward amounts would be formatted against the wrong chain config.
**Fix:** Removed the module-level constant. Added `const explorer = getExplorerBase(receiptChainId)` inside the component (after `receiptChainId` is derived from the connected wallet), and replaced all hardcoded usages with `explorer` and `receiptChainId`.

### 2. Unhandled 'howitworks' nav route
**File:** `src/App.tsx`
**Finding:** The landing page header and footer nav called `navigate('howitworks')`, but `'howitworks'` was not in the `View` type union and had no render case. Clicking "How It Works" in the nav would silently fail — the view state would be set to an unrecognised value and no page would render.
**Fix:** Added `'howitworks'` to the `View` type. In `navigate()`, intercept `'howitworks'` before the state setter: set view to `'landing'`, then use a 80ms `setTimeout` to `document.getElementById('how-it-works').scrollIntoView()` after the landing page has rendered.

### 3. Missing null guard for receipt_verify view
**File:** `src/App.tsx`
**Finding:** The `receipt_verify` view only rendered when `selectedReceiptId` was non-null. If a user navigated to `receipt_verify` without a receipt ID (e.g. from the nav bar directly), nothing would render in the main content area — blank white panel.
**Fix:** Added a fallback render block for `view === 'receipt_verify' && !selectedReceiptId` showing a clear "No receipt ID specified" message with a link to the Dashboard.

### 4. `verifiedInteraction` hardcoded to `true` on deserialization
**File:** `src/hooks/useReviews.ts`
**Finding:** `loadAllReviews()` set `verifiedInteraction: true` on every loaded review regardless of what was stored. A review stored with `verifiedInteraction: false` (e.g. from a future admin process) would be silently upgraded to `true` after a page reload. This undermines the integrity of the field.
**Fix:** Changed to `verifiedInteraction: r['verifiedInteraction'] !== false` — preserves `true` for new reviews (where eligibility was checked), `false` for reviews explicitly marked that way, and defaults to `true` for legacy records that lack the field.

### 5. Overly permissive CORS + missing OPTIONS handler
**File:** `server/ai.ts`
**Finding:** `Access-Control-Allow-Origin: *` allowed any origin to call the AI evaluation endpoint. No explicit `OPTIONS` pre-flight handler, so browsers making pre-flight requests before POST would fail silently. In production deployments, arbitrary sites could forward evaluation requests through the user's browser session.
**Fix:** Replaced with an `ALLOWED_ORIGINS` Set containing `localhost:5173`, the Arc Studio sandbox preview hostname, and the Vercel deployment URL. Added explicit `OPTIONS` handler that returns `204` for allowed origins. Added `Vary: Origin` header.

### 6. Race-condition duplicate receipt creation
**File:** `src/hooks/useReceipts.ts`
**Finding:** `createReceipt` checks for duplicates by reading localStorage, then computes SHA-256 (async). During the async gap, a second call with the same `(bountyId, contributorAddress)` pair could pass the duplicate check and both would write to storage, creating two receipts for the same bounty completion.
**Fix:** Added a module-level `IN_FLIGHT_KEYS = new Set<string>()`. Both the standalone `createReceipt` and the hook's inner version now: (1) check the set, return early if present; (2) add the key; (3) wrap the rest in `try/finally` that deletes the key on completion. Verified by a new concurrent-creation test (`Promise.all` of two calls) — only one succeeds.

---

## Integrations Verified

**Complete workflow (read through code, not live test):**
1. Creator creates bounty on Arc Testnet → `createBounty` + `fundBounty` → onchain
2. Contributor submits work → localStorage under `veritas_submissions_v1`
3. Creator runs AI evaluation → POST `/api/evaluate` → stored in `veritas_evaluations_v1`
4. Creator approves → `approveContributor()` onchain → `markApproved()` in localStorage
5. Creator releases payment → `releasePayment()` onchain → `markPaid()` in localStorage
6. Receipt automatically created in `onPaid` callback with `chainId` + `escrowContractAddress` from connected wallet
7. Receipt stored in `veritas_receipts_v1`; SHA-256 integrity hash computed via Web Crypto
8. Public verify page at `?receipt=<id>` shows two independent panels: integrity check + onchain check
9. Contributor profile updates are independent of receipt — no auto-population
10. Reviews available after `paid` status; eligibility enforced in `useReviews`

**Cross-cutting data flow confirmed clean:**
- `BountyDetailPage` → both `onPaid` paths (normal + resume) → `createReceipt` with correct `chainId`/`escrowContractAddress`
- `DashboardPage` → `ReceiptsSection` → `onViewReceipt(receiptId)` → `App.tsx` `openReceipt` → `ReceiptVerifyPage`
- `LeaderboardPage`, `ProfilePage` → data from real `useSubmissions` + `useReviews` hooks, never fabricated

---

## Security Improvements

| Area | Before | After |
|---|---|---|
| CORS | `*` (any origin) | Allowlist: localhost, sandbox preview, Vercel deploy |
| OPTIONS pre-flight | No handler (browser would fail) | Explicit 204 response |
| verifiedInteraction | Always set to `true` on load | Reads stored value; defaults `true` for legacy records only |
| Receipt race condition | Two concurrent calls could both write | Module-level in-flight lock |
| TX links on mainnet | Always pointed to testnet explorer | Derived from connected chain ID |
| receipt_verify empty state | Blank panel | Clear error with navigation |

---

## Tests Executed

| Test file | Tests | Result |
|---|---|---|
| `integration.stage7.test.ts` (new) | 20 | Pass |
| `useReceipts.test.ts` | 15 | Pass |
| `useOnchainReceiptVerifier.test.ts` | 22 | Pass |
| `useEvaluations.test.ts` | 24 | Pass |
| `server.validateRequest.test.ts` | 34 | Pass |
| **Total** | **115** | **115/115** |

**lint:** 0 warnings, 0 errors  
**tsc:** 0 errors

---

## Remaining Limitations

### Not yet addressable without architecture changes

1. **Submission data is localStorage-only.** Submissions do not sync across browsers or devices. A creator on a different device cannot see submissions. This is the existing design decision (documented since Stage 4).

2. **Receipt sharing requires same browser.** The public verification link (`?receipt=<id>`) only works on a device where the receipt is stored. Recipients need a backend receipt store to share receipts publicly — out of scope per the project's current architecture.

3. **AI evaluation endpoint CORS relies on deploy URL.** If the Vercel deployment URL changes, `ALLOWED_ORIGINS` in `server/ai.ts` must be updated. This is a configuration item, not a code defect.

4. **HIGH-4 from Stage 6 still documented-only.** The localStorage contributor address trust issue (approveContributor address sourced from local storage not independently verified) remains. Full fix requires EIP-712 signed messages or a backend — deferred per original Stage 6 decision.

5. **`createdAt` on bounties is approximate.** `bounty.createdAt` is derived as `deadline - 30*86400`. This is displayed in profiles and the leaderboard with appropriate "approximate" labelling.

6. **AI evaluation backend requires separate process.** `bun run server` must be started alongside `bun run dev`. Without it, AI evaluation shows a clear "unavailable" state and manual review still works fully.

### No critical issues blocking demo

All six High findings from Stage 7 have been fixed. No fabricated data, no hardcoded addresses in financial paths, no silent failures on navigation. The escrow contract is unchanged.
