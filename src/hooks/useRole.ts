/**
 * useRole — per-wallet role management.
 *
 * Roles:
 *   'creator'    — posts bounties, manages payouts
 *   'freelancer' — hunts bounties, submits work
 *   null         — not yet chosen (triggers role-select screen)
 *
 * Freelancers can flip to 'creator' mode via switchToCreator().
 * switchBack() returns them to 'freelancer'.
 *
 * Stored in localStorage under "veripay_role_v1:<address>".
 * Resets to null when wallet disconnects.
 */

import { useState, useCallback } from 'react'
import { useAccount } from './useAccount'

export type UserRole = 'creator' | 'freelancer'

function storageKey(address: string) {
  return `veripay_role_v1:${address.toLowerCase()}`
}

function loadRole(address: string): UserRole | null {
  try {
    const raw = localStorage.getItem(storageKey(address))
    if (raw === 'creator' || raw === 'freelancer') return raw
  } catch {}
  return null
}

function saveRole(address: string, role: UserRole) {
  try {
    localStorage.setItem(storageKey(address), role)
  } catch {}
}

export interface UseRoleResult {
  /** The user's stored role, or null if not yet chosen. */
  role: UserRole | null
  /** True when the freelancer has temporarily switched to creator mode. */
  isSwitchedToCreator: boolean
  /** Effective role: isSwitchedToCreator overrides 'freelancer' → 'creator'. */
  effectiveRole: UserRole | null
  /** Set the permanent role (shown on first connect). */
  chooseRole: (r: UserRole) => void
  /** Freelancer-only: temporarily switch to creator mode. */
  switchToCreator: () => void
  /** Return from temporary creator mode back to freelancer. */
  switchBackToFreelancer: () => void
  /** True when the wallet is connected and a role has been chosen. */
  roleReady: boolean
}

export function useRole(): UseRoleResult {
  const { address, isConnected } = useAccount()
  // Track the last address we saved a role for; lets us detect address changes
  const [savedAddress, setSavedAddress] = useState<string | null>(null)
  const [savedRole, setSavedRole] = useState<UserRole | null>(null)
  const [isSwitchedToCreator, setIsSwitchedToCreator] = useState(false)

  // Derive role from storage — no useEffect needed; runs on every render when address changes
  const currentAddress = isConnected && address ? address.toLowerCase() : null
  let role: UserRole | null = savedRole
  if (currentAddress !== savedAddress) {
    // Address changed (connect/disconnect/switch): re-read from storage synchronously
    const loaded = currentAddress ? loadRole(currentAddress) : null
    role = loaded
    // Schedule state sync without calling setState in render body — use a lazy ref pattern:
    // We do it in a queueMicrotask to avoid "setState during render"
    queueMicrotask(() => {
      setSavedAddress(currentAddress)
      setSavedRole(loaded)
      setIsSwitchedToCreator(false)
    })
  }

  const chooseRole = useCallback(
    (r: UserRole) => {
      if (!address) return
      saveRole(address, r)
      setSavedAddress(address.toLowerCase())
      setSavedRole(r)
      setIsSwitchedToCreator(false)
    },
    [address],
  )

  const switchToCreator = useCallback(() => {
    setIsSwitchedToCreator(true)
  }, [])

  const switchBackToFreelancer = useCallback(() => {
    setIsSwitchedToCreator(false)
  }, [])

  const effectiveRole: UserRole | null =
    role === 'freelancer' && isSwitchedToCreator ? 'creator' : role

  return {
    role,             // the stored role (null = not chosen)
    isSwitchedToCreator,
    effectiveRole,
    chooseRole,
    switchToCreator,
    switchBackToFreelancer,
    roleReady: isConnected && role !== null,
  }
}
