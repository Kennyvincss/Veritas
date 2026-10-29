/**
 * useProfiles — user profile storage for VERITAS.
 *
 * Storage: localStorage under PROFILES_KEY, keyed by wallet address.
 * Profiles are clearly offchain application state. Wallet address is the
 * identity anchor — users can only edit their own profile (verified by
 * comparing connected address to profile.address).
 *
 * Username uniqueness is enforced across all stored profiles before save.
 */

import { useState, useEffect, useCallback } from 'react'
import type { UserProfile } from '@/types/bounty'

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const PROFILES_KEY = 'veritas_profiles_v1'

function sanitize(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

export function loadAllProfiles(): Record<string, UserProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, UserProfile>
  } catch {
    return {}
  }
}

function saveAllProfiles(profiles: Record<string, UserProfile>): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

// ---------------------------------------------------------------------------
// Validation helpers (exported for use in forms)
// ---------------------------------------------------------------------------

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/
const ALLOWED_SCHEMES = new Set(['https:', 'http:'])

export function validateUsername(username: string): string | null {
  if (!username.trim()) return 'Username is required.'
  if (!USERNAME_RE.test(username))
    return 'Username must be 3–30 characters: letters, numbers, and underscores only.'
  return null
}

export function validateUrl(url: string): string | null {
  if (!url.trim()) return null
  try {
    const parsed = new URL(url)
    if (!ALLOWED_SCHEMES.has(parsed.protocol))
      return 'URL must start with https:// or http://'
    return null
  } catch {
    return 'Invalid URL format.'
  }
}

// ---------------------------------------------------------------------------
// Default display name from address
// ---------------------------------------------------------------------------

export function defaultDisplayName(address: string): string {
  if (!address) return 'Anonymous'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SaveProfileParams {
  address: string
  displayName: string
  username: string
  bio: string
  skills: string[]
  website?: string
  twitterHandle?: string
  githubHandle?: string
  avatarDataUrl?: string
}

export interface UseProfilesResult {
  /** All profiles, keyed by lowercase address. */
  profiles: Record<string, UserProfile>
  /** Get profile for an address (case-insensitive). */
  getProfile: (address: string) => UserProfile | undefined
  /** Get profile by username (case-insensitive). */
  getByUsername: (username: string) => UserProfile | undefined
  /**
   * Save or update a profile. The connected wallet address must match params.address.
   * Returns {ok: true} or {ok: false, error: string}.
   */
  saveProfile: (
    params: SaveProfileParams,
    connectedAddress: string,
  ) => { ok: true; profile: UserProfile } | { ok: false; error: string }
  /** Force reload from localStorage. */
  refresh: () => void
}

export function useProfiles(): UseProfilesResult {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>(loadAllProfiles)

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PROFILES_KEY) setProfiles(loadAllProfiles())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refresh = useCallback(() => setProfiles(loadAllProfiles()), [])

  const getProfile = useCallback(
    (address: string) => profiles[address.toLowerCase()],
    [profiles],
  )

  const getByUsername = useCallback(
    (username: string) => {
      const lower = username.toLowerCase()
      return Object.values(profiles).find((p) => p.username.toLowerCase() === lower)
    },
    [profiles],
  )

  const saveProfile = useCallback(
    (
      params: SaveProfileParams,
      connectedAddress: string,
    ): { ok: true; profile: UserProfile } | { ok: false; error: string } => {
      // Only the connected wallet can save their own profile
      if (params.address.toLowerCase() !== connectedAddress.toLowerCase()) {
        return { ok: false, error: 'You can only edit your own profile.' }
      }

      // Validate username
      const usernameErr = validateUsername(params.username)
      if (usernameErr) return { ok: false, error: usernameErr }

      // Validate optional URLs
      const websiteErr = params.website ? validateUrl(params.website) : null
      if (websiteErr) return { ok: false, error: `Website: ${websiteErr}` }

      // Sanitize text fields
      const cleanDisplayName = sanitize(params.displayName).slice(0, 60)
      if (!cleanDisplayName) return { ok: false, error: 'Display name is required.' }
      const cleanBio = sanitize(params.bio).slice(0, 300)
      const cleanSkills = params.skills
        .map((s) => sanitize(s).slice(0, 40))
        .filter(Boolean)
        .slice(0, 10)
      const cleanTwitter = sanitize(params.twitterHandle ?? '').replace('@', '').slice(0, 50) || undefined
      const cleanGithub = sanitize(params.githubHandle ?? '').slice(0, 50) || undefined
      const cleanWebsite = params.website?.trim() || undefined

      // Username uniqueness — skip check for the same address updating their own username
      const all = loadAllProfiles()
      const lowerUsername = params.username.toLowerCase()
      const conflict = Object.values(all).find(
        (p) =>
          p.username.toLowerCase() === lowerUsername &&
          p.address.toLowerCase() !== params.address.toLowerCase(),
      )
      if (conflict) return { ok: false, error: `Username "${params.username}" is already taken.` }

      const existing = all[params.address.toLowerCase()]
      const now = Math.floor(Date.now() / 1000)
      const profile: UserProfile = {
        address: params.address,
        displayName: cleanDisplayName,
        username: params.username,
        bio: cleanBio,
        skills: cleanSkills,
        website: cleanWebsite,
        twitterHandle: cleanTwitter,
        githubHandle: cleanGithub,
        avatarDataUrl: params.avatarDataUrl ?? existing?.avatarDataUrl,
        joinedAt: existing?.joinedAt ?? now,
        updatedAt: now,
      }

      const updated = { ...all, [params.address.toLowerCase()]: profile }
      saveAllProfiles(updated)
      setProfiles(updated)

      return { ok: true, profile }
    },
    [],
  )

  return { profiles, getProfile, getByUsername, saveProfile, refresh }
}
