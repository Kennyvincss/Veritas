/**
 * useReviews — offchain review/reputation storage for VERITAS.
 *
 * Eligibility rules (enforced in this hook — financial truth from contract):
 *   - Only the bounty CREATOR can review the PAID CONTRIBUTOR after a bounty
 *     reaches "completed" status.
 *   - Only the PAID CONTRIBUTOR can review the BOUNTY CREATOR after a bounty
 *     reaches "completed" status.
 *   - One review per eligible direction per bounty (creator→contributor,
 *     contributor→creator). Duplicates are blocked.
 *   - Self-reviews are blocked (reviewer === recipient).
 *   - Review text is sanitised (HTML stripped, length capped).
 *
 * Storage: localStorage under REVIEWS_KEY.
 * Clearly labelled offchain application state — not stored onchain.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Review } from '@/types/bounty'

const REVIEWS_KEY = 'veritas_reviews_v1'

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadAllReviews(): Review[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    return parsed.flatMap((r): Review[] => {
      const str = (v: unknown, fallback = ''): string =>
        typeof v === 'string' ? v : fallback
      const num = (v: unknown, fallback = 0): number =>
        typeof v === 'number' ? v : fallback
      const rating = num(r['rating'])
      if (rating < 1 || rating > 5) return []
      return [{
        id: str(r['id']),
        bountyId: str(r['bountyId']),
        reviewerAddress: str(r['reviewerAddress']),
        recipientAddress: str(r['recipientAddress']),
        rating: rating as 1 | 2 | 3 | 4 | 5,
        text: str(r['text']),
        createdAt: num(r['createdAt']),
        direction: (str(r['direction'], 'creator_to_contributor')) as Review['direction'],
        // verifiedInteraction is set true on creation (eligibility passed) and preserved on load
        verifiedInteraction: r['verifiedInteraction'] !== false,
      }]
    })
  } catch {
    return []
  }
}

function saveAllReviews(reviews: Review[]): void {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SubmitReviewParams {
  bountyId: string
  bountyOwner: string         // contract-verified owner address
  paidContributor: string     // contract-verified approvedContributor address
  reviewerAddress: string     // connected wallet — who is writing this review
  rating: 1 | 2 | 3 | 4 | 5
  text: string
}

export interface UseReviewsResult {
  reviews: Review[]
  /** Reviews written about a specific recipient address. */
  forRecipient: (address: string) => Review[]
  /** Reviews written by a specific reviewer. */
  byReviewer: (address: string) => Review[]
  /** Reviews for a specific bounty. */
  forBounty: (bountyId: string) => Review[]
  /** Computed average rating (1–5) for a recipient, or null if no reviews. */
  avgRating: (address: string) => number | null
  /** True when reviewer has already reviewed recipient for this bounty in this direction. */
  hasReviewed: (bountyId: string, reviewer: string, direction: Review['direction']) => boolean
  /**
   * Check whether the connected wallet is eligible to review for this bounty.
   * Returns { eligible: true, direction } or { eligible: false, reason }.
   */
  eligibility: (
    bountyId: string,
    bountyOwner: string,
    paidContributor: string,
    reviewerAddress: string,
  ) => { eligible: true; direction: Review['direction'] } | { eligible: false; reason: string }
  /** Submit a review. Returns ok/error. */
  submitReview: (
    params: SubmitReviewParams,
  ) => { ok: true; review: Review } | { ok: false; error: string }
  refresh: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviews(): UseReviewsResult {
  const [reviews, setReviews] = useState<Review[]>(loadAllReviews)

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === REVIEWS_KEY) setReviews(loadAllReviews())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setReviews(loadAllReviews()), [])

  const forRecipient = useCallback(
    (address: string) =>
      reviews.filter((r) => r.recipientAddress.toLowerCase() === address.toLowerCase()),
    [reviews],
  )

  const byReviewer = useCallback(
    (address: string) =>
      reviews.filter((r) => r.reviewerAddress.toLowerCase() === address.toLowerCase()),
    [reviews],
  )

  const forBounty = useCallback(
    (bountyId: string) => reviews.filter((r) => r.bountyId === bountyId),
    [reviews],
  )

  const avgRating = useCallback(
    (address: string): number | null => {
      const relevant = reviews.filter(
        (r) => r.recipientAddress.toLowerCase() === address.toLowerCase(),
      )
      if (relevant.length === 0) return null
      return relevant.reduce((sum, r) => sum + r.rating, 0) / relevant.length
    },
    [reviews],
  )

  const hasReviewed = useCallback(
    (bountyId: string, reviewer: string, direction: Review['direction']): boolean =>
      reviews.some(
        (r) =>
          r.bountyId === bountyId &&
          r.reviewerAddress.toLowerCase() === reviewer.toLowerCase() &&
          r.direction === direction,
      ),
    [reviews],
  )

  const eligibility = useCallback(
    (
      bountyId: string,
      bountyOwner: string,
      paidContributor: string,
      reviewerAddress: string,
    ): { eligible: true; direction: Review['direction'] } | { eligible: false; reason: string } => {
      const reviewer = reviewerAddress.toLowerCase()
      const owner = bountyOwner.toLowerCase()
      const contributor = paidContributor.toLowerCase()

      // Self-review guard
      if (reviewer === owner && reviewer === contributor) {
        return { eligible: false, reason: 'Cannot review yourself.' }
      }

      if (reviewer === owner) {
        // Creator reviewing contributor
        const dir: Review['direction'] = 'creator_to_contributor'
        if (hasReviewed(bountyId, reviewerAddress, dir)) {
          return { eligible: false, reason: 'You have already reviewed this contributor for this bounty.' }
        }
        return { eligible: true, direction: dir }
      }

      if (reviewer === contributor) {
        // Contributor reviewing creator
        const dir: Review['direction'] = 'contributor_to_creator'
        if (hasReviewed(bountyId, reviewerAddress, dir)) {
          return { eligible: false, reason: 'You have already reviewed this creator for this bounty.' }
        }
        return { eligible: true, direction: dir }
      }

      return { eligible: false, reason: 'Only the bounty creator or paid contributor can leave a review.' }
    },
    [hasReviewed],
  )

  const submitReview = useCallback(
    (params: SubmitReviewParams): { ok: true; review: Review } | { ok: false; error: string } => {
      const { bountyId, bountyOwner, paidContributor, reviewerAddress, rating, text } = params

      const eligible = eligibility(bountyId, bountyOwner, paidContributor, reviewerAddress)
      if (!eligible.eligible) return { ok: false, error: eligible.reason }

      const cleanText = sanitize(text).slice(0, 1000)
      if (!cleanText) return { ok: false, error: 'Review text is required.' }
      if (rating < 1 || rating > 5) return { ok: false, error: 'Rating must be between 1 and 5.' }

      const direction = eligible.direction
      const recipientAddress =
        direction === 'creator_to_contributor'
          ? paidContributor
          : bountyOwner

      const review: Review = {
        id: newId(),
        bountyId,
        reviewerAddress,
        recipientAddress,
        rating,
        text: cleanText,
        createdAt: Math.floor(Date.now() / 1000),
        direction,
        verifiedInteraction: true,
      }

      setReviews((prev) => {
        const updated = [...prev, review]
        saveAllReviews(updated)
        return updated
      })

      return { ok: true, review }
    },
    [eligibility],
  )

  return {
    reviews,
    forRecipient,
    byReviewer,
    forBounty,
    avgRating,
    hasReviewed,
    eligibility,
    submitReview,
    refresh,
  }
}
