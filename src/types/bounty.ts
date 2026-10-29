/**
 * VERITAS — core domain types
 * All onchain amounts are stored as bigint (raw ERC-20 units, 6 decimals USDC).
 */

export type BountyStatus =
  | 'draft'      // Created onchain but NOT YET funded — no USDC in escrow; cannot accept submissions
  | 'open'       // Funded — USDC held in escrow; accepting submissions
  | 'in_review'  // Funded + a winner has been chosen (Approved state onchain)
  | 'completed'  // Payment released onchain (Paid)
  | 'cancelled'  // Owner cancelled, USDC returned
  | 'expired'    // Deadline passed, no payment released (not a contract state — derived)

/**
 * Full set of application-level submission statuses.
 *
 * Offchain states (localStorage only):
 *   pending, under_review, revision_requested, rejected
 *
 * Onchain-backed states:
 *   approved — approveContributor() confirmed; payout tx pending
 *   paid     — releasePayment() confirmed onchain; txHash stored
 */
export type SubmissionStatus =
  | 'pending'            // waiting for owner review
  | 'under_review'       // creator has opened the submission for review
  | 'revision_requested' // creator asked for changes
  | 'approved'           // approveContributor() confirmed onchain (payout in progress)
  | 'paid'               // releasePayment() confirmed onchain — USDC sent to contributor
  | 'rejected'           // owner rejected — bounty stays open

/** A single deliverable link submitted with a work submission. */
export interface DeliverableLink {
  label: string   // short human label (e.g. "GitHub repo", "Live demo")
  url: string
}

/**
 * A bounty record — mirrors what lives in the escrow contract.
 * `id` is the contract-level bounty ID (uint256).
 * `rewardRaw` is the USDC ERC-20 amount in 6-decimal integer form.
 */
export interface Bounty {
  id: string
  owner: string
  title: string
  description: string
  rewardRaw: bigint          // 6-decimal USDC units
  deadline: number           // Unix timestamp
  status: BountyStatus
  /**
   * Populated when onchain status is Approved or Paid.
   * The address that was passed to approveContributor() — the one that will receive / has received payment.
   */
  approvedContributor?: string
  contractAddress?: string   // set after the escrow contract is deployed (Stage 2)
  txHash?: string            // funding transaction hash
  createdAt: number          // Unix timestamp
}

// ---------------------------------------------------------------------------
// User Profile
// ---------------------------------------------------------------------------

/**
 * A user profile, keyed by wallet address.
 * Stored offchain in localStorage under veritas_profiles_v1.
 * Avatar is a base64 data URL or undefined (falls back to deterministic avatar).
 */
export interface UserProfile {
  address: string           // checksummed wallet address — the identity key
  displayName: string       // 1–60 chars
  username: string          // 3–30 chars, alphanumeric + underscores, unique
  bio: string               // max 300 chars
  skills: string[]          // up to 10 skill tags
  website?: string          // optional https URL
  twitterHandle?: string    // optional, no @ prefix
  githubHandle?: string     // optional
  avatarDataUrl?: string    // base64-encoded image (resized to 128x128 before storage)
  /** Alias kept for component compatibility — same value as avatarDataUrl */
  avatarUrl?: string
  joinedAt: number          // Unix timestamp of first profile save
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/**
 * A review left by one participant in a completed bounty interaction.
 *
 * Eligibility rules (enforced in useReviews):
 *   - reviewer must be the bounty owner OR the paid contributor
 *   - recipient must be the other party in the same completed bounty
 *   - only one review per (bountyId, reviewer) pair
 *   - self-reviews are blocked (reviewer !== recipient)
 *   - only valid after the submission status is 'paid'
 *
 * Stored offchain in localStorage under veritas_reviews_v1.
 * Clearly distinct from onchain contract state.
 */
export interface Review {
  id: string
  bountyId: string
  reviewerAddress: string    // wallet address of the reviewer
  recipientAddress: string   // wallet address of the recipient
  rating: 1 | 2 | 3 | 4 | 5
  text: string               // sanitized, max 1000 chars
  createdAt: number          // Unix timestamp (seconds)
  direction: 'creator_to_contributor' | 'contributor_to_creator'
  /** True — always. Marks that this review is tied to a paid bounty interaction. */
  verifiedInteraction: boolean
}

/**
 * A work submission from a contributor.
 * Stored entirely offchain in localStorage (contract has no submission list).
 * Each submission is keyed by a generated UUID-like id.
 */
export interface Submission {
  id: string
  bountyId: string
  contributor: string           // checksummed wallet address
  title: string                 // max 150 chars
  summary: string               // work description / how task was completed
  deliverables: DeliverableLink[] // one or more links
  status: SubmissionStatus
  txHash?: string               // payout transaction hash (set on approval, Stage 5)
  submittedAt: number           // Unix timestamp (seconds)
  updatedAt: number             // Unix timestamp (seconds) — when status last changed
  creatorNote?: string          // feedback / revision request from bounty owner
}

// ---------------------------------------------------------------------------
// AI Evaluation (Stage 4)
// ---------------------------------------------------------------------------

/**
 * Status of a single acceptance criterion evaluation.
 * These values come from the AI and are schema-validated before storage.
 */
export type CriterionStatus = 'satisfied' | 'not_satisfied' | 'unclear'

/**
 * AI evaluation result for one acceptance criterion.
 */
export interface CriterionResult {
  /** The criterion text, exactly as provided to the evaluator. */
  criterion: string
  /** AI assessment of whether the criterion is met. */
  status: CriterionStatus
  /** Short plain-English explanation (AI-generated, not instructions). */
  reason: string
  /**
   * Reference to evidence in the submission (title/summary excerpt, link label, etc.).
   * Empty string when no specific evidence was identified.
   */
  evidence: string
  /**
   * What the contributor still needs to provide to satisfy this criterion.
   * Empty string when already satisfied.
   */
  missing: string
}

/**
 * The AI evaluator's overall recommendation.
 * Advisory only — never triggers any payment, approval, or receipt.
 */
export type AIRecommendation =
  | 'recommend_approval'
  | 'request_revisions'
  | 'human_review_required'

/**
 * Overall status of an evaluation record.
 *
 *   pending     — created but evaluation has not run yet
 *   running     — API call in flight
 *   complete    — AI returned a valid, schema-validated result
 *   failed      — API error, timeout, schema validation failure, or provider unavailable
 *   unavailable — AI provider not configured
 */
export type EvaluationStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'unavailable'

/**
 * A single AI evaluation run. Each run is a new, immutable record.
 * Re-running an evaluation creates a new entry (increments `version`).
 * Previous versions are never overwritten or deleted.
 *
 * SAFETY INVARIANTS (enforced by useEvaluations and AIEvaluationPanel):
 *   - An evaluation record CANNOT approve a submission.
 *   - An evaluation record CANNOT trigger releasePayment or any onchain tx.
 *   - An evaluation record CANNOT issue or modify a WorkReceipt.
 *   - The `recommendation` field is advisory only.
 *   - The `humanDecision` field is recorded separately and does NOT auto-populate.
 *
 * Stored offchain in localStorage under `veritas_evaluations_v1`.
 * Clearly labelled as AI-generated content — not onchain state.
 */
export interface AIEvaluation {
  /** Globally unique evaluation ID. */
  evaluationId: string

  /** The bounty this evaluation covers. */
  bountyId: string

  /** Human-readable bounty title (snapshot). */
  bountyTitle: string

  /** The submission being evaluated. */
  submissionId: string

  /** Wallet address of the contributor being evaluated. */
  contributorAddress: string

  /** Wallet address of the bounty creator who requested this evaluation. */
  requestedBy: string

  /**
   * The acceptance criteria text as provided to the evaluator.
   * Snapshot at evaluation time — if criteria changed after bounty publication,
   * this records what was actually used. May be flagged as 'criteria_unverified'.
   */
  criteriaSnapshot: string

  /**
   * True if the criteria snapshot could not be verified as the original
   * (e.g. bounty description was empty or criteria section missing).
   */
  criteriaUnverified: boolean

  /** Unix timestamp (seconds) when evaluation was requested. */
  requestedAt: number

  /** Unix timestamp (seconds) when evaluation completed (or failed). */
  completedAt?: number

  /** Version counter — 1 for the first evaluation, increments on re-run. */
  version: number

  /** Current evaluation status. */
  status: EvaluationStatus

  /** Error message when status === 'failed'. */
  errorMessage?: string

  // ── AI result fields (populated only when status === 'complete') ──────────

  /** Per-criterion results. */
  criterionResults?: CriterionResult[]

  /** Brief overall summary of the submitted work (AI-generated). */
  workSummary?: string

  /**
   * Advisory recommendation from the AI.
   * MUST NOT be used to trigger any financial transaction or receipt.
   */
  recommendation?: AIRecommendation

  /**
   * Confidence level: 'high' | 'medium' | 'low'.
   * AI's self-assessment; treat with appropriate scepticism.
   */
  confidence?: 'high' | 'medium' | 'low'

  /** Plain-English explanation of confidence level. */
  confidenceExplanation?: string

  /** Issues the AI could not assess (e.g. inaccessible links, binary files). */
  limitations?: string[]

  /** AI provider identifier (e.g. 'openai'). */
  provider?: string

  /** Model identifier (e.g. 'gpt-4o-mini'). Never a secret — models are public names. */
  model?: string

  // ── Human decision (recorded separately, never auto-populated) ───────────

  /**
   * The bounty creator's own decision, recorded AFTER reviewing AI results.
   * Null until the creator explicitly records it.
   * This field has NO effect on the smart contract or payment flow.
   */
  humanDecision?: 'approved' | 'revisions_requested' | 'rejected' | null

  /** When the human decision was recorded. */
  humanDecisionAt?: number

  /** Optional note the creator adds alongside their human decision. */
  humanDecisionNote?: string
}

// ---------------------------------------------------------------------------
// Work Receipt
// ---------------------------------------------------------------------------

/**
 * Receipt integrity status (Stage 1) — covers the local hash check only.
 *
 *   pending           — receipt created but hash not yet checked
 *   hash_verified     — canonical hash matches stored hash; data is intact
 *   hash_mismatch     — stored hash no longer matches fields; data may be tampered
 */
export type ReceiptIntegrityStatus =
  | 'pending'
  | 'hash_verified'
  | 'hash_mismatch'

/**
 * Onchain verification status (Stage 2) — covers the independent blockchain check.
 *
 *   not_checked         — verification has not been attempted yet
 *   onchain_verified    — all checks passed: tx exists, succeeded, correct contract,
 *                         correct recipient, correct amount, correct bountyId, Paid state
 *   onchain_failed      — tx found but one or more checks failed (wrong recipient,
 *                         wrong amount, failed tx, wrong contract, etc.)
 *   onchain_pending     — tx exists but does not have enough confirmations yet
 *   rpc_unavailable     — could not reach the RPC endpoint; result is inconclusive
 *   insufficient_data   — receipt is missing required fields (txHash, chainId, escrowAddress)
 *   unsupported_network — receipt references a chain this verifier does not support
 */
export type OnchainVerificationStatus =
  | 'not_checked'
  | 'onchain_verified'
  | 'onchain_failed'
  | 'onchain_pending'
  | 'rpc_unavailable'
  | 'insufficient_data'
  | 'unsupported_network'

/**
 * Combined legacy status alias kept for UI components that only need a single value.
 * Stage 2 UIs should prefer ReceiptIntegrityStatus + OnchainVerificationStatus separately.
 */
export type ReceiptVerificationStatus = ReceiptIntegrityStatus

/**
 * A Proof-of-Work Receipt — created automatically when a submission is marked
 * `paid` (i.e., releasePayment confirmed onchain).
 *
 * Uniqueness: one receipt per (bountyId, contributorAddress) pair — enforced by
 * useReceipts before creation. Duplicate creation is silently rejected.
 *
 * Storage: localStorage under `veritas_receipts_v1`, keyed by receiptId.
 * Clearly labelled offchain application state — not stored onchain.
 *
 * Integrity: `integrityHash` is a SHA-256 (hex) of the canonical JSON of the
 * immutable receipt fields. The hash is recomputed on every read and compared to
 * the stored value. Any field mutation is detected.
 *
 * Private submission content (summary, deliverable URLs, creator notes) is NOT
 * stored in the receipt — only public references are kept.
 */
export interface WorkReceipt {
  /** Globally unique receipt ID (collision-resistant, URL-safe). */
  receiptId: string

  /** The onchain bounty ID (matches Bounty.id). */
  bountyId: string

  /** Human-readable bounty title (snapshot at receipt creation time). */
  bountyTitle: string

  /** Wallet address of the bounty creator (owner). */
  creatorAddress: string

  /** Wallet address of the contributor who completed the work. */
  contributorAddress: string

  /**
   * Reference to the offchain submission record.
   * Kept as an opaque ID — private submission content is not embedded here.
   */
  submissionId: string

  /**
   * SHA-256 hex hash of the submission title + summary at receipt creation time.
   * Allows later comparison to detect if submission content changed, without
   * embedding the full private content in the receipt.
   */
  submissionContentHash: string

  /**
   * The original bounty description at the time the receipt was created.
   * Acts as a snapshot of the acceptance criteria context.
   */
  bountyDescriptionSnapshot: string

  /** Raw USDC reward amount (6-decimal bigint serialised as decimal string). */
  rewardRawString: string

  /** "USDC" — token symbol, always USDC for this version. */
  rewardToken: 'USDC'

  /** Unix timestamp (seconds) when releasePayment was confirmed. */
  completedAt: number

  /**
   * The on-chain transaction hash of the releasePayment call.
   * May be undefined in the rare case the tx hash was not captured —
   * this is a known limitation noted in the UI.
   */
  paymentTxHash?: string

  /** Unix timestamp (seconds) when this receipt was created. */
  createdAt: number

  /**
   * Current verification status.
   * Set to 'hash_verified' after initial creation; becomes 'hash_mismatch'
   * if integrityHash no longer matches when the receipt is loaded.
   */
  verificationStatus: ReceiptVerificationStatus

  /**
   * SHA-256 hex of the canonical JSON of the immutable receipt fields.
   * Recomputed and compared on every read to detect tampering.
   * The hash covers: receiptId, bountyId, bountyTitle, creatorAddress,
   * contributorAddress, submissionId, submissionContentHash,
   * rewardRawString, rewardToken, completedAt, paymentTxHash, createdAt,
   * chainId, escrowContractAddress.
   */
  integrityHash: string

  // ── Stage 2: Onchain verification fields ────────────────────────────────────

  /**
   * The EVM chain ID on which the payment was made.
   * Required for onchain verification. Immutable after creation (included in hash).
   * Arc Testnet = 5042002, Arc Mainnet = 5042.
   */
  chainId: number

  /**
   * The VeritasEscrow contract address on the payment chain.
   * Required for verifying that the PaymentReleased event came from the right contract.
   * Immutable after creation (included in hash).
   */
  escrowContractAddress: string

  /**
   * Current onchain verification status.
   * Mutable — updated by the verifier; NOT included in the integrity hash.
   * Starts at 'not_checked'; updated after a verification attempt.
   */
  onchainVerificationStatus: OnchainVerificationStatus

  /**
   * Human-readable explanation of the most recent onchain verification result.
   * Mutable — NOT included in the integrity hash.
   */
  onchainVerificationDetail?: string

  /**
   * Unix timestamp (seconds) when the last successful onchain verification ran.
   * Undefined if onchain verification has not been attempted or succeeded.
   * Mutable — NOT included in the integrity hash.
   */
  onchainVerifiedAt?: number
}
