import { useState, useEffect, useCallback } from 'react'

export interface JobApplication {
  id: string
  jobId: string
  jobTitle: string
  jobOwner: string
  applicantAddress: string
  message: string
  status: 'pending' | 'approved' | 'declined'
  createdAt: number
  updatedAt: number
}

export function useApplications(params: {
  jobId?: string
  applicantAddress?: string
  jobOwner?: string
}) {
  const [applications, setApplications] = useState<JobApplication[]>([])

  const fetch_ = useCallback(async () => {
    const q = new URLSearchParams()
    if (params.jobId) q.set('jobId', params.jobId)
    if (params.applicantAddress) q.set('applicantAddress', params.applicantAddress)
    if (params.jobOwner) q.set('jobOwner', params.jobOwner)
    try {
      const res = await fetch(`/api/applications?${q.toString()}`)
      if (!res.ok) return
      const data = await res.json() as { ok: boolean; applications: JobApplication[] }
      if (data.ok) setApplications(data.applications)
    } catch { /* ignore */ }
  }, [params.jobId, params.applicantAddress, params.jobOwner])

  useEffect(() => {
    const run = () => { void fetch_() }
    run()
    const t = setInterval(run, 8_000)
    return () => clearInterval(t)
  }, [fetch_])

  const apply = useCallback(async (p: {
    jobId: string; jobTitle: string; jobOwner: string; applicantAddress: string; message: string
  }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      const text = await res.text()
      let data: { ok: boolean; error?: string } | null = null
      try { data = JSON.parse(text) as { ok: boolean; error?: string } } catch { /* not JSON */ }
      if (data?.ok) { void fetch_(); return { ok: true } }
      return { ok: false, error: data?.error ?? (res.ok ? 'Failed to apply.' : `Server error (${res.status}). The service may be starting up — try again in a moment.`) }
    } catch (err) {
      console.error('[useApplications] apply error', err)
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
    }
  }, [fetch_])

  const updateStatus = useCallback(async (
    applicationId: string,
    status: 'approved' | 'declined',
    callerAddress: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`/api/applications?id=${encodeURIComponent(applicationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, callerAddress }),
      })
      const text = await res.text()
      let data: { ok: boolean; error?: string } | null = null
      try { data = JSON.parse(text) as { ok: boolean; error?: string } } catch { /* not JSON */ }
      if (data?.ok) { void fetch_(); return { ok: true } }
      return { ok: false, error: data?.error ?? (res.ok ? 'Failed to update.' : `Server error (${res.status}). Try again in a moment.`) }
    } catch (err) {
      console.error('[useApplications] updateStatus error', err)
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
    }
  }, [fetch_])

  return { applications, apply, updateStatus, refresh: fetch_ }
}
