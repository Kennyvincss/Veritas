/**
 * useSubmissions — offchain submission storage for VERITAS.
 *
 * Storage architecture:
 *   - All submissions are persisted in localStorage under SUBMISSIONS_KEY.
 *   - The contract (VeritasEscrow) has no submission list; only the final
 *     approved contributor address is stored onchain. Off-chain storage is
 *     the correct architecture here.
 *   - Submissions are clearly labelled as offchain application state.
 *   - Persists across page refreshes and is accessible from all views.
 *   - Cross-tab sync is handled via the 'storage' event.
 *
 * Security invariants enforced here (frontend layer):
 *   - A contributor cannot submit to their own bounty (owner === contributor).
 *   - A contributor cannot submit to a bounty they already submitted to
 *     (one submission per contributor per bounty).
 *   - Submission titles are sanitised (HTML-stripped, length-capped).
 *   - Only the bounty owner can change submission status.
 *   - These are frontend guards — the source of truth for financial operations
 *     is the smart contract (Stage 5).
 */

import { useState, useEffect, useCallback } from 'react'
import type { Submission, SubmissionStatus, DeliverableLink } from '@/types/bounty'

// ---------------------------------------------------------------------------
// Storage key + serialisation helpers
// ---------------------------------------------------------------------------

const SUBMISSIONS_KEY = 'veritas_submissions_v1'

/** Load all submissions from localStorage. */
export function loadAllSubmissions(): Submission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    // Normalise legacy entries that may lack newer fields
    return parsed.map((s): Submission => {
      const str = (v: unknown, fallback = ''): string =>
        typeof v === 'string' ? v : fallback
      const num = (v: unknown, fallback = 0): number =>
        typeof v === 'number' ? v : fallback
      const legacyUrl = str(s['deliverableUrl'])
      const deliverables: DeliverableLink[] = Array.isArray(s['deliverables'])
        ? (s['deliverables'] as Record<string, unknown>[]).map((d) => ({
            label: str(d['label']),
            url: str(d['url']),
          }))
        : legacyUrl
        ? [{ label: 'Deliverable', url: legacyUrl }]
        : []
      const summary = str(s['summary'])
      return {
        id: str(s['id']),
        bountyId: str(s['bountyId']),
        contributor: str(s['contributor']),
        title: str(s['title'], summary.slice(0, 150) || 'Untitled'),
        summary,
        deliverables,
        status: (str(s['status'], 'pending')) as Submission['status'],
        txHash: typeof s['txHash'] === 'string' ? s['txHash'] : undefined,
        submittedAt: num(s['submittedAt']),
        updatedAt: num(s['updatedAt'], num(s['submittedAt'])),
        creatorNote: typeof s['creatorNote'] === 'string' ? s['creatorNote'] : undefined,
      }
    })
  } catch {
    return []
  }
}

function saveAllSubmissions(submissions: Submission[]): void {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions))
}

/** Generate a simple collision-resistant ID. */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/** Strip HTML tags from a string to prevent XSS in stored content. */
function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface SubmitWorkParams {
  bountyId: string
  bountyOwner: string    // checked against contributor to block self-submission
  contributor: string   // connected wallet address
  title: string         // max 150 chars
  summary: string       // work description
  deliverables: DeliverableLink[]
}

export interface UseSubmissionsResult {
  /** All submissions across all bounties. */
  submissions: Submission[]
  /** Submissions for a specific bounty. */
  forBounty: (bountyId: string) => Submission[]
  /** Submissions made by a specific contributor. */
  forContributor: (address: string) => Submission[]
  /** True if the contributor already has a submission for a given bounty. */
  hasSubmitted: (bountyId: string, contributor: string) => boolean
  /** Create a new submission. Returns the created Submission or an error string. */
  submit: (params: SubmitWorkParams) => { ok: true; submission: Submission } | { ok: false; error: string }
  /** Update submission status (owner only — caller must verify ownership). */
  updateStatus: (
    submissionId: string,
    newStatus: SubmissionStatus,
    ownerAddress: string,
    bountyOwner: string,
    creatorNote?: string,
  ) => { ok: true } | { ok: false; error: string }
  /**
   * Mark a submission as approved (approveContributor tx confirmed onchain).
   * Called by the approval hook after on-chain confirmation — no ownership check
   * here because the contract already enforced it.
   */
  markApproved: (submissionId: string) => void
  /**
   * Mark a submission as paid (releasePayment tx confirmed onchain).
   * Stores the payout transaction hash.
   */
  markPaid: (submissionId: string, txHash: string) => void
  /** Force a refresh from localStorage (e.g. after cross-tab write). */
  refresh: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSubmissions(): UseSubmissionsResult {
  const [submissions, setSubmissions] = useState<Submission[]>(loadAllSubmissions)

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === SUBMISSIONS_KEY) setSubmissions(loadAllSubmissions())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setSubmissions(loadAllSubmissions()), [])

  // ── Readers ──────────────────────────────────────────────────────────────

  const forBounty = useCallback(
    (bountyId: string) => submissions.filter((s) => s.bountyId === bountyId),
    [submissions],
  )

  const forContributor = useCallback(
    (address: string) =>
      submissions.filter((s) => s.contributor.toLowerCase() === address.toLowerCase()),
    [submissions],
  )

  const hasSubmitted = useCallback(
    (bountyId: string, contributor: string) =>
      submissions.some(
        (s) =>
          s.bountyId === bountyId &&
          s.contributor.toLowerCase() === contributor.toLowerCase(),
      ),
    [submissions],
  )

  // ── Writers ──────────────────────────────────────────────────────────────

  const submit = useCallback(
    (params: SubmitWorkParams): { ok: true; submission: Submission } | { ok: false; error: string } => {
      const { bountyId, bountyOwner, contributor, title, summary, deliverables } = params

      // Guard: contributor cannot be the owner
      if (contributor.toLowerCase() === bountyOwner.toLowerCase()) {
        return { ok: false, error: 'You cannot submit to your own bounty.' }
      }

      // Guard: no duplicate submissions
      if (hasSubmitted(bountyId, contributor)) {
        return { ok: false, error: 'You have already submitted work for this bounty.' }
      }

      // Validate inputs
      const cleanTitle = sanitize(title).slice(0, 150)
      if (!cleanTitle) return { ok: false, error: 'Submission title is required.' }
      const cleanSummary = sanitize(summary)
      if (!cleanSummary) return { ok: false, error: 'Work description is required.' }

      // Validate deliverable URLs — only https: and http: are permitted.
      // javascript:, data:, blob:, and other schemes are rejected to prevent XSS.
      const ALLOWED_SCHEMES = new Set(['https:', 'http:'])
      for (const d of deliverables) {
        if (!d.url.trim()) continue
        let parsed: URL
        try { parsed = new URL(d.url) } catch {
          return { ok: false, error: `Invalid URL: ${d.url}` }
        }
        if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
          return { ok: false, error: `URL must start with https:// (got ${parsed.protocol})` }
        }
        if (d.url.length > 512) return { ok: false, error: 'A deliverable URL is too long (max 512 chars).' }
      }

      const now = Math.floor(Date.now() / 1000)
      const submission: Submission = {
        id: newId(),
        bountyId,
        contributor,
        title: cleanTitle,
        summary: cleanSummary,
        deliverables: deliverables.filter((d) => d.url.trim()),
        status: 'pending',
        submittedAt: now,
        updatedAt: now,
      }

      setSubmissions((prev) => {
        const updated = [...prev, submission]
        saveAllSubmissions(updated)
        return updated
      })

      return { ok: true, submission }
    },
    [hasSubmitted],
  )

  const updateStatus = useCallback(
    (
      submissionId: string,
      newStatus: SubmissionStatus,
      ownerAddress: string,
      bountyOwner: string,
      creatorNote?: string,
    ): { ok: true } | { ok: false; error: string } => {
      // Only the bounty owner can change status
      if (ownerAddress.toLowerCase() !== bountyOwner.toLowerCase()) {
        return { ok: false, error: 'Only the bounty owner can update submission status.' }
      }

      let found = false
      setSubmissions((prev) => {
        const updated = prev.map((s) => {
          if (s.id !== submissionId) return s
          found = true
          return {
            ...s,
            status: newStatus,
            updatedAt: Math.floor(Date.now() / 1000),
            creatorNote: creatorNote !== undefined ? sanitize(creatorNote) : s.creatorNote,
          }
        })
        if (found) saveAllSubmissions(updated)
        return updated
      })

      if (!found) return { ok: false, error: 'Submission not found.' }
      return { ok: true }
    },
    [],
  )

  const markApproved = useCallback((submissionId: string) => {
    setSubmissions((prev) => {
      const now = Math.floor(Date.now() / 1000)
      const updated: Submission[] = prev.map((s) =>
        s.id === submissionId
          ? { ...s, status: 'approved' as const, updatedAt: now }
          : s,
      )
      saveAllSubmissions(updated)
      return updated
    })
  }, [])

  const markPaid = useCallback((submissionId: string, txHash: string) => {
    setSubmissions((prev) => {
      const now = Math.floor(Date.now() / 1000)
      const updated: Submission[] = prev.map((s) =>
        s.id === submissionId
          ? { ...s, status: 'paid' as const, txHash, updatedAt: now }
          : s,
      )
      saveAllSubmissions(updated)
      return updated
    })
  }, [])

  return {
    submissions,
    forBounty,
    forContributor,
    hasSubmitted,
    submit,
    updateStatus,
    markApproved,
    markPaid,
    refresh,
  }
}
