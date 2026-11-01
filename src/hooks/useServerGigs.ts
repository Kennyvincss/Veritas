/**
 * useServerGigs — server-backed gig store.
 * Replaces the localStorage useGigs so gigs posted by a freelancer
 * are visible to all users (creators on other devices/browsers).
 */
import { useState, useEffect, useCallback } from 'react'
import type { Gig, GigCategory } from '@/types/gig'

export function useServerGigs(opts?: { freelancerAddress?: string }) {
  const [gigs, setGigs] = useState<Gig[]>([])
  const [loading, setLoading] = useState(true)
  const addrFilter = opts?.freelancerAddress

  const fetchGigs = useCallback(async () => {
    try {
      const q = addrFilter
        ? `?freelancerAddress=${encodeURIComponent(addrFilter)}`
        : ''
      const res = await fetch(`/api/gigs${q}`)
      if (!res.ok) return
      const data = await res.json() as { ok: boolean; gigs: Gig[] }
      if (data.ok) setGigs(data.gigs)
    } catch { /* network error */ } finally {
      setLoading(false)
    }
  }, [addrFilter])

  useEffect(() => {
    const run = () => { void fetchGigs() }
    run()
    const t = setInterval(run, 15_000)
    return () => clearInterval(t)
  }, [fetchGigs])

  const postGig = useCallback(async (
    data: Omit<Gig, 'id' | 'createdAt'>,
  ): Promise<{ ok: true; gig: Gig } | { ok: false; error: string }> => {
    try {
      const res = await fetch(`/api/gigs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const text = await res.text()
      let json: { ok: boolean; gig?: Gig; error?: string } | null = null
      try { json = JSON.parse(text) as { ok: boolean; gig?: Gig; error?: string } } catch { /* not JSON */ }
      if (json?.ok && json.gig) {
        setGigs((prev) => [json.gig!, ...prev])
        return { ok: true, gig: json.gig }
      }
      return { ok: false, error: json?.error ?? (res.ok ? 'Failed to post gig.' : `Server error (${res.status}) — the service may be starting up, try again in a moment.`) }
    } catch (err) {
      console.error('[useServerGigs] postGig error', err)
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
    }
  }, [])

  const deleteGig = useCallback(async (id: string, callerAddress: string): Promise<void> => {
    try {
      await fetch(`/api/gigs/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerAddress }),
      })
      setGigs((prev) => prev.filter((g) => g.id !== id))
    } catch { /* ignore */ }
  }, [])

  const forFreelancer = useCallback(
    (address: string) => gigs.filter((g) => g.freelancerAddress.toLowerCase() === address.toLowerCase()),
    [gigs],
  )

  const byCategory = useCallback(
    (cat: GigCategory) => gigs.filter((g) => g.category === cat),
    [gigs],
  )

  return { gigs, loading, postGig, deleteGig, forFreelancer, byCategory, refresh: fetchGigs }
}
