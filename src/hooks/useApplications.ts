import { useState, useEffect, useCallback } from 'react'

const AI_BASE = import.meta.env.VITE_AI_SERVER_URL as string | undefined

function apiBase(): string {
  return AI_BASE ? AI_BASE.replace(/\/$/, '') : ''
}

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
      const res = await fetch(`${apiBase()}/api/applications?${q.toString()}`)
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
      const res = await fetch(`${apiBase()}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) { void fetch_(); return { ok: true } }
      return { ok: false, error: data.error ?? 'Failed to apply.' }
    } catch { return { ok: false, error: 'Network error.' } }
  }, [fetch_])

  const updateStatus = useCallback(async (
    applicationId: string,
    status: 'approved' | 'declined',
    callerAddress: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`${apiBase()}/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, callerAddress }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) { void fetch_(); return { ok: true } }
      return { ok: false, error: data.error ?? 'Failed to update.' }
    } catch { return { ok: false, error: 'Network error.' } }
  }, [fetch_])

  return { applications, apply, updateStatus, refresh: fetch_ }
}
