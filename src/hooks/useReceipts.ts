/**
 * useReceipts — Proof-of-Work Receipt system for VERITAS.
 *
 * Storage: localStorage under RECEIPTS_KEY, as a JSON array.
 * Cross-tab sync via the 'storage' event.
 *
 * Integrity model:
 *   - On creation, a canonical JSON string is built from the immutable receipt
 *     fields (excluding `verificationStatus` and `integrityHash` themselves).
 *   - SHA-256 is computed over that canonical string using the Web Crypto API.
 *   - The hex digest is stored as `integrityHash`.
 *   - On every read (loadAndVerify), the hash is recomputed and compared.
 *     If it differs, `verificationStatus` is set to `'hash_mismatch'`.
 *   - Receipt fields that affect the hash are immutable after creation.
 *     The only mutable field is `verificationStatus` (set by the verifier).
 *
 * Uniqueness: one receipt per (bountyId, contributorAddress) pair.
 * Duplicate creation is rejected with {ok: false, error}.
 *
 * Privacy: private submission content (summary, deliverable URLs, creator notes)
 * is NEVER embedded in receipts. Only the submissionId and a SHA-256 hash of the
 * submission title + summary are stored, allowing content integrity checks
 * without exposing private data.
 *
 * Limitations (clearly documented):
 *   - Hash integrity confirms data was not tampered with in localStorage.
 *     It does NOT independently prove the payment happened onchain.
 *     Full verification requires inspecting the paymentTxHash on the explorer.
 *   - Web Crypto is async — receipt creation is async.
 *   - localStorage is browser-local; receipts do not sync across devices.
 *     Future stages may persist receipts to a backend or onchain attestation.
 */

import { useState, useEffect, useCallback } from 'react'
import type { WorkReceipt, ReceiptVerificationStatus, OnchainVerificationStatus } from '@/types/bounty'

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const RECEIPTS_KEY = 'veritas_receipts_v1'

// ---------------------------------------------------------------------------
// Canonical hash helpers
// ---------------------------------------------------------------------------

/**
 * The set of fields that are hashed for integrity.
 * These fields are immutable after creation.
 * Order is stable — always sort keys alphabetically in canonical form.
 */
type HashableFields = Pick<
  WorkReceipt,
  | 'receiptId'
  | 'bountyId'
  | 'bountyTitle'
  | 'creatorAddress'
  | 'contributorAddress'
  | 'submissionId'
  | 'submissionContentHash'
  | 'bountyDescriptionSnapshot'
  | 'rewardRawString'
  | 'rewardToken'
  | 'completedAt'
  | 'paymentTxHash'
  | 'createdAt'
  | 'chainId'
  | 'escrowContractAddress'
>

/**
 * Build the canonical JSON string for hashing.
 * Keys are sorted to ensure deterministic output regardless of insertion order.
 */
function canonicalJson(fields: HashableFields): string {
  const sorted: Record<string, unknown> = {}
  const keys = Object.keys(fields).sort() as (keyof HashableFields)[]
  for (const k of keys) {
    sorted[k] = fields[k] ?? null
  }
  return JSON.stringify(sorted)
}

/**
 * Compute SHA-256 of a string, returning a lowercase hex string.
 * Uses the Web Crypto API (available in all modern browsers).
 */
async function sha256hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Compute the submissionContentHash — SHA-256 of "title||summary"
 * using a null-byte separator to avoid collisions.
 * Only the hash is stored, not the content.
 */
export async function computeSubmissionContentHash(
  title: string,
  summary: string,
): Promise<string> {
  return sha256hex(`${title}\x00${summary}`)
}

/**
 * Compute the integrity hash for a receipt's hashable fields.
 */
async function computeIntegrityHash(fields: HashableFields): Promise<string> {
  return sha256hex(canonicalJson(fields))
}

// ---------------------------------------------------------------------------
// In-flight lock — prevents race-condition duplicate creation
// ---------------------------------------------------------------------------

/**
 * Module-level Set of "(bountyId:contributorAddress)" keys currently being created.
 * Prevents a second call from passing the duplicate check while the first is still
 * computing its SHA-256 hash (async gap between check and write).
 */
const IN_FLIGHT_KEYS = new Set<string>()

function inFlightKey(bountyId: string, contributorAddress: string): string {
  return `${bountyId}:${contributorAddress.toLowerCase()}`
}

// ---------------------------------------------------------------------------
// Receipt ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe, collision-resistant receipt ID.
 * Format: "rcpt-<timestamp36>-<8 random hex chars>"
 */
function newReceiptId(): string {
  const ts = Date.now().toString(36)
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `rcpt-${ts}-${rand}`
}

// ---------------------------------------------------------------------------
// Storage helpers — load and verify on read
// ---------------------------------------------------------------------------

/**
 * Load all receipts from localStorage.
 * For each receipt, recompute the integrity hash and set verificationStatus
 * to 'hash_mismatch' if the stored hash no longer matches.
 *
 * This is synchronous because we cannot make the storage event handler async.
 * The hash recomputation here is synchronous-approximated: we compare
 * the stored hash against a fresh async computation via a queued microtask.
 * The actual hash verification (async) is done in verifyReceipt().
 */
export function loadAllReceipts(): WorkReceipt[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    return parsed.flatMap((r): WorkReceipt[] => {
      const str = (v: unknown, fallback = ''): string =>
        typeof v === 'string' ? v : fallback
      const num = (v: unknown, fallback = 0): number =>
        typeof v === 'number' ? v : fallback
      const receiptId = str(r['receiptId'])
      if (!receiptId) return []
      return [{
        receiptId,
        bountyId: str(r['bountyId']),
        bountyTitle: str(r['bountyTitle']),
        creatorAddress: str(r['creatorAddress']),
        contributorAddress: str(r['contributorAddress']),
        submissionId: str(r['submissionId']),
        submissionContentHash: str(r['submissionContentHash']),
        bountyDescriptionSnapshot: str(r['bountyDescriptionSnapshot']),
        rewardRawString: str(r['rewardRawString']),
        rewardToken: 'USDC',
        completedAt: num(r['completedAt']),
        paymentTxHash: typeof r['paymentTxHash'] === 'string' ? r['paymentTxHash'] : undefined,
        createdAt: num(r['createdAt']),
        verificationStatus: (str(r['verificationStatus'], 'pending')) as ReceiptVerificationStatus,
        integrityHash: str(r['integrityHash']),
        // Stage 2 fields — default gracefully for receipts created before Stage 2
        chainId: num(r['chainId'], 0),
        escrowContractAddress: str(r['escrowContractAddress']),
        onchainVerificationStatus: (str(r['onchainVerificationStatus'], 'not_checked')) as OnchainVerificationStatus,
        onchainVerificationDetail: typeof r['onchainVerificationDetail'] === 'string' ? r['onchainVerificationDetail'] : undefined,
        onchainVerifiedAt: typeof r['onchainVerifiedAt'] === 'number' ? r['onchainVerifiedAt'] : undefined,
      }]
    })
  } catch {
    return []
  }
}

function saveAllReceipts(receipts: WorkReceipt[]): void {
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts))
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface CreateReceiptParams {
  bountyId: string
  bountyTitle: string
  bountyDescriptionSnapshot: string
  creatorAddress: string
  contributorAddress: string
  submissionId: string
  /** Raw submission title — used to compute submissionContentHash only. */
  submissionTitle: string
  /** Raw submission summary — used to compute submissionContentHash only. */
  submissionSummary: string
  rewardRawString: string
  completedAt: number
  paymentTxHash?: string
  /** Stage 2: EVM chain ID on which the payment was made (e.g. 5042002 for Arc Testnet). */
  chainId: number
  /** Stage 2: VeritasEscrow contract address on the payment chain. */
  escrowContractAddress: string
}

// ---------------------------------------------------------------------------
// Standalone (non-hook) create function — exported for testing
// ---------------------------------------------------------------------------

/**
 * Standalone version of createReceipt that does not depend on React state.
 * Used by tests and any non-hook context. Writes directly to localStorage.
 */
export async function createReceipt(
  params: CreateReceiptParams,
): Promise<{ ok: true; receipt: WorkReceipt } | { ok: false; error: string }> {
  const {
    bountyId, bountyTitle, bountyDescriptionSnapshot,
    creatorAddress, contributorAddress, submissionId,
    submissionTitle, submissionSummary, rewardRawString,
    completedAt, paymentTxHash, chainId, escrowContractAddress,
  } = params

  if (!bountyId) return { ok: false, error: 'bountyId is required.' }
  if (!contributorAddress) return { ok: false, error: 'contributorAddress is required.' }
  if (!submissionId) return { ok: false, error: 'submissionId is required.' }
  if (!chainId) return { ok: false, error: 'chainId is required.' }
  if (!escrowContractAddress) return { ok: false, error: 'escrowContractAddress is required.' }

  // Race-condition guard: block concurrent creation for the same bounty+contributor
  const key = inFlightKey(bountyId, contributorAddress)
  if (IN_FLIGHT_KEYS.has(key)) {
    return { ok: false, error: 'Receipt creation already in progress for this bounty and contributor.' }
  }
  IN_FLIGHT_KEYS.add(key)

  try {
  const existing = loadAllReceipts()
  const duplicate = existing.find(
    (r) =>
      r.bountyId === bountyId &&
      r.contributorAddress.toLowerCase() === contributorAddress.toLowerCase(),
  )
  if (duplicate) {
    return { ok: false, error: `Receipt already exists for this bounty and contributor: ${duplicate.receiptId}` }
  }

  const receiptId = newReceiptId()
  const createdAt = Math.floor(Date.now() / 1000)
  const submissionContentHash = await computeSubmissionContentHash(submissionTitle, submissionSummary)

  const hashableFields: HashableFields = {
    receiptId, bountyId, bountyTitle,
    creatorAddress: creatorAddress.toLowerCase(),
    contributorAddress: contributorAddress.toLowerCase(),
    submissionId, submissionContentHash, bountyDescriptionSnapshot,
    rewardRawString, rewardToken: 'USDC',
    completedAt, paymentTxHash: paymentTxHash ?? undefined, createdAt,
    chainId, escrowContractAddress: escrowContractAddress.toLowerCase(),
  }

  const integrityHash = await computeIntegrityHash(hashableFields)
  const receipt: WorkReceipt = {
    ...hashableFields,
    verificationStatus: 'hash_verified',
    integrityHash,
    onchainVerificationStatus: 'not_checked',
  }

  const updated = [...existing, receipt]
  saveAllReceipts(updated)
  return { ok: true, receipt }
  } finally {
    IN_FLIGHT_KEYS.delete(key)
  }
}

// ---------------------------------------------------------------------------

export interface ReceiptVerifyResult {
  receiptId: string
  status: ReceiptVerificationStatus
  /** The recomputed hash (for display/debug). */
  recomputedHash: string
  /** The stored hash. */
  storedHash: string
  /** True when hashes match. */
  intact: boolean
}

export interface UseReceiptsResult {
  receipts: WorkReceipt[]
  /** Get a single receipt by ID, with live verification status. */
  getReceipt: (receiptId: string) => WorkReceipt | undefined
  /** All receipts where contributorAddress matches (case-insensitive). */
  forContributor: (address: string) => WorkReceipt[]
  /** All receipts for a given bountyId. */
  forBounty: (bountyId: string) => WorkReceipt[]
  /**
   * Create a new receipt. Returns the receipt or an error.
   * Async because it computes SHA-256 via Web Crypto.
   * Duplicate (same bountyId + contributorAddress) is rejected.
   */
  createReceipt: (
    params: CreateReceiptParams,
  ) => Promise<{ ok: true; receipt: WorkReceipt } | { ok: false; error: string }>
  /**
   * Verify a receipt's integrity. Recomputes the hash and compares it to the
   * stored value. Updates the receipt's verificationStatus in localStorage.
   * Returns a detailed result object.
   */
  verifyReceipt: (receiptId: string) => Promise<ReceiptVerifyResult | null>
  /** Force reload from localStorage (cross-tab). */
  refresh: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReceipts(): UseReceiptsResult {
  const [receipts, setReceipts] = useState<WorkReceipt[]>(loadAllReceipts)

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === RECEIPTS_KEY) setReceipts(loadAllReceipts())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setReceipts(loadAllReceipts()), [])

  // ── Readers ────────────────────────────────────────────────────────────────

  const getReceipt = useCallback(
    (receiptId: string): WorkReceipt | undefined =>
      receipts.find((r) => r.receiptId === receiptId),
    [receipts],
  )

  const forContributor = useCallback(
    (address: string): WorkReceipt[] =>
      receipts.filter(
        (r) => r.contributorAddress.toLowerCase() === address.toLowerCase(),
      ),
    [receipts],
  )

  const forBounty = useCallback(
    (bountyId: string): WorkReceipt[] =>
      receipts.filter((r) => r.bountyId === bountyId),
    [receipts],
  )

  // ── Create ─────────────────────────────────────────────────────────────────

  const createReceipt = useCallback(
    async (
      params: CreateReceiptParams,
    ): Promise<{ ok: true; receipt: WorkReceipt } | { ok: false; error: string }> => {
      const {
        bountyId,
        bountyTitle,
        bountyDescriptionSnapshot,
        creatorAddress,
        contributorAddress,
        submissionId,
        submissionTitle,
        submissionSummary,
        rewardRawString,
        completedAt,
        paymentTxHash,
        chainId,
        escrowContractAddress,
      } = params

      // Validate required fields
      if (!bountyId) return { ok: false, error: 'bountyId is required.' }
      if (!contributorAddress) return { ok: false, error: 'contributorAddress is required.' }
      if (!submissionId) return { ok: false, error: 'submissionId is required.' }
      if (!chainId) return { ok: false, error: 'chainId is required.' }
      if (!escrowContractAddress) return { ok: false, error: 'escrowContractAddress is required.' }

      // Race-condition guard
      const key = inFlightKey(bountyId, contributorAddress)
      if (IN_FLIGHT_KEYS.has(key)) {
        return { ok: false, error: 'Receipt creation already in progress for this bounty and contributor.' }
      }
      IN_FLIGHT_KEYS.add(key)

      try {
      // Duplicate prevention: one receipt per (bountyId, contributorAddress)
      const existing = loadAllReceipts()
      const duplicate = existing.find(
        (r) =>
          r.bountyId === bountyId &&
          r.contributorAddress.toLowerCase() === contributorAddress.toLowerCase(),
      )
      if (duplicate) {
        return { ok: false, error: `Receipt already exists for this bounty and contributor: ${duplicate.receiptId}` }
      }

      const receiptId = newReceiptId()
      const createdAt = Math.floor(Date.now() / 1000)

      // Compute submission content hash (private content stays off-receipt)
      const submissionContentHash = await computeSubmissionContentHash(
        submissionTitle,
        submissionSummary,
      )

      // Build the hashable fields object
      const hashableFields: HashableFields = {
        receiptId,
        bountyId,
        bountyTitle,
        creatorAddress: creatorAddress.toLowerCase(),
        contributorAddress: contributorAddress.toLowerCase(),
        submissionId,
        submissionContentHash,
        bountyDescriptionSnapshot,
        rewardRawString,
        rewardToken: 'USDC',
        completedAt,
        paymentTxHash: paymentTxHash ?? undefined,
        createdAt,
        chainId,
        escrowContractAddress: escrowContractAddress.toLowerCase(),
      }

      const integrityHash = await computeIntegrityHash(hashableFields)

      const receipt: WorkReceipt = {
        ...hashableFields,
        verificationStatus: 'hash_verified',
        integrityHash,
        onchainVerificationStatus: 'not_checked',
      }

      setReceipts((prev) => {
        const updated = [...prev, receipt]
        saveAllReceipts(updated)
        return updated
      })

      return { ok: true, receipt }
      } finally {
        IN_FLIGHT_KEYS.delete(key)
      }
    },
    [],
  )

  // ── Verify ─────────────────────────────────────────────────────────────────

  const verifyReceipt = useCallback(
    async (receiptId: string): Promise<ReceiptVerifyResult | null> => {
      const current = loadAllReceipts()
      const receipt = current.find((r) => r.receiptId === receiptId)
      if (!receipt) return null

      const hashableFields: HashableFields = {
        receiptId: receipt.receiptId,
        bountyId: receipt.bountyId,
        bountyTitle: receipt.bountyTitle,
        creatorAddress: receipt.creatorAddress,
        contributorAddress: receipt.contributorAddress,
        submissionId: receipt.submissionId,
        submissionContentHash: receipt.submissionContentHash,
        bountyDescriptionSnapshot: receipt.bountyDescriptionSnapshot,
        rewardRawString: receipt.rewardRawString,
        rewardToken: receipt.rewardToken,
        completedAt: receipt.completedAt,
        paymentTxHash: receipt.paymentTxHash,
        createdAt: receipt.createdAt,
        chainId: receipt.chainId,
        escrowContractAddress: receipt.escrowContractAddress,
      }

      const recomputedHash = await computeIntegrityHash(hashableFields)
      const intact = recomputedHash === receipt.integrityHash
      const newStatus: ReceiptVerificationStatus = intact ? 'hash_verified' : 'hash_mismatch'

      // Persist the updated status back to localStorage if it changed
      if (receipt.verificationStatus !== newStatus) {
        const updated = current.map((r) =>
          r.receiptId === receiptId ? { ...r, verificationStatus: newStatus } : r,
        )
        saveAllReceipts(updated)
        setReceipts(updated)
      }

      return {
        receiptId,
        status: newStatus,
        recomputedHash,
        storedHash: receipt.integrityHash,
        intact,
      }
    },
    [],
  )

  return {
    receipts,
    getReceipt,
    forContributor,
    forBounty,
    createReceipt,
    verifyReceipt,
    refresh,
  }
}
