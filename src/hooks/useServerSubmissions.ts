/**
 * useServerSubmissions — shared submission storage via the Express backend.
 *
 * Replaces localStorage-only useSubmissions for cross-user visibility.
 * The server stores all submissions in memory (Fly.io single instance = shared).
 *
 * Falls back gracefully when the server is unreachable (offline / dev without server).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Submission, DeliverableLink } from '@/types/bounty'

// Relative paths — works in dev (Vite proxy) and production (Vercel functions).
function apiUrl(path: string) { return path }

export interface ServerSubmitParams {
  bountyId: string
  bountyTitle: string
  bountyOwner: string
  contributor: string
  title: string
  summary: string
  deliverables: DeliverableLink[]
}

export interface UseServerSubmissionsResult {
  submissions: Submission[]
  loading: boolean
  error: string | null
  forBounty: (bountyId: string) => Submission[]
  forContributor: (address: string) => Submission[]
  hasSubmitted: (bountyId: string, contributor: string) => boolean
  submit: (params: ServerSubmitParams) => Promise<{ ok: true; submission: Submission } | { ok: false; error: string }>
  updateStatus: (
    submissionId: string,
    newStatus: string,
    callerAddress: string,
    creatorNote?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  markPaid: (submissionId: string, txHash: string) => Promise<void>
  refresh: () => void
}

export function useServerSubmissions(bountyId?: string): UseServerSubmissionsResult {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const url = bountyId
        ? apiUrl(`/api/submissions?bountyId=${encodeURIComponent(bountyId)}`)
        : apiUrl('/api/submissions')
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json() as { ok: boolean; submissions: Submission[] }
      setSubmissions(data.submissions ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [bountyId])

  // Initial fetch + 10s polling for live updates
  useEffect(() => {
    const run = () => { void fetchSubmissions() }
    run()
    pollRef.current = setInterval(run, 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchSubmissions])

  const refresh = useCallback(() => { void fetchSubmissions() }, [fetchSubmissions])

  const forBounty = useCallback(
    (bId: string) => submissions.filter((s) => s.bountyId === bId),
    [submissions],
  )

  const forContributor = useCallback(
    (address: string) => submissions.filter((s) => s.contributor.toLowerCase() === address.toLowerCase()),
    [submissions],
  )

  const hasSubmitted = useCallback(
    (bId: string, contributor: string) =>
      submissions.some(
        (s) => s.bountyId === bId && s.contributor.toLowerCase() === contributor.toLowerCase(),
      ),
    [submissions],
  )

  const submit = useCallback(async (params: ServerSubmitParams) => {
    try {
      const res = await fetch(apiUrl('/api/submissions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json() as { ok: boolean; submission?: Submission; error?: string }
      if (!data.ok || !data.submission) return { ok: false as const, error: data.error ?? 'Submission failed.' }
      setSubmissions((prev) => [...prev, data.submission!])
      return { ok: true as const, submission: data.submission }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : 'Network error.' }
    }
  }, [])

  const updateStatus = useCallback(async (
    submissionId: string,
    newStatus: string,
    callerAddress: string,
    creatorNote?: string,
  ) => {
    try {
      const res = await fetch(apiUrl(`/api/submissions?id=${encodeURIComponent(submissionId)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, callerAddress, creatorNote }),
      })
      const data = await res.json() as { ok: boolean; submission?: Submission; error?: string }
      if (!data.ok) return { ok: false as const, error: data.error ?? 'Update failed.' }
      if (data.submission) {
        setSubmissions((prev) => prev.map((s) => s.id === submissionId ? data.submission! : s))
      }
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : 'Network error.' }
    }
  }, [])

  const markPaid = useCallback(async (submissionId: string, txHash: string) => {
    await updateStatus(submissionId, 'paid', '', undefined)
    // Also patch txHash — server doesn't have a dedicated field but we update local state
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId ? { ...s, status: 'paid' as const, txHash } : s,
      ),
    )
  }, [updateStatus])

  return {
    submissions,
    loading,
    error,
    forBounty,
    forContributor,
    hasSubmitted,
    submit,
    updateStatus,
    markPaid,
    refresh,
  }
}
