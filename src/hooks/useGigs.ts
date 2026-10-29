/**
 * useGigs — localStorage store for freelancer gig offerings.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Gig, GigCategory } from '@/types/gig'

const GIGS_KEY = 'veripay_gigs_v1'

function loadGigs(): Gig[] {
  try {
    const raw = localStorage.getItem(GIGS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Gig[]
  } catch {
    return []
  }
}

function saveGigs(gigs: Gig[]) {
  localStorage.setItem(GIGS_KEY, JSON.stringify(gigs))
}

export function useGigs() {
  const [gigs, setGigs] = useState<Gig[]>(() => loadGigs())

  // Cross-tab sync
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === GIGS_KEY) setGigs(loadGigs())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const postGig = useCallback((
    data: Omit<Gig, 'id' | 'createdAt'>,
  ): Gig => {
    const gig: Gig = {
      ...data,
      id: `gig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    }
    setGigs((prev) => {
      const next = [gig, ...prev]
      saveGigs(next)
      return next
    })
    return gig
  }, [])

  const deleteGig = useCallback((id: string, callerAddress: string) => {
    setGigs((prev) => {
      const gig = prev.find((g) => g.id === id)
      if (!gig || gig.freelancerAddress.toLowerCase() !== callerAddress.toLowerCase()) return prev
      const next = prev.filter((g) => g.id !== id)
      saveGigs(next)
      return next
    })
  }, [])

  const forFreelancer = useCallback(
    (address: string) => gigs.filter((g) => g.freelancerAddress.toLowerCase() === address.toLowerCase()),
    [gigs],
  )

  const byCategory = useCallback(
    (cat: GigCategory) => gigs.filter((g) => g.category === cat),
    [gigs],
  )

  return { gigs, postGig, deleteGig, forFreelancer, byCategory }
}
