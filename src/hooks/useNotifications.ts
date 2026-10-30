/**
 * useNotifications — polls /api/notifications for the connected user.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const AI_BASE = (import.meta.env['VITE_AI_SERVER_URL'] as string | undefined)?.replace(/\/$/, '') ?? ''
function apiUrl(path: string) { return AI_BASE ? `${AI_BASE}${path}` : path }

export interface AppNotification {
  id: string
  recipientAddress: string
  type: 'new_submission' | 'status_update' | 'payment_released' | 'bounty_cancelled'
  title: string
  message: string
  bountyId: string
  submissionId?: string
  createdAt: number
  read: boolean
}

export function useNotifications(address: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch_ = useCallback(async () => {
    if (!address) return
    try {
      const res = await fetch(apiUrl(`/api/notifications?address=${encodeURIComponent(address.toLowerCase())}`))
      if (!res.ok) return
      const data = await res.json() as { ok: boolean; notifications: AppNotification[] }
      setNotifications(data.notifications ?? [])
    } catch {
      // silently ignore — notifications are non-critical
    }
  }, [address])

  useEffect(() => {
    const run = () => { void fetch_() }
    run()
    pollRef.current = setInterval(run, 15_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetch_])

  const markRead = useCallback(async (ids?: string[]) => {
    if (!address) return
    try {
      await fetch(apiUrl('/api/notifications/read'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.toLowerCase(), ids: ids ?? [] }),
      })
      setNotifications((prev) =>
        prev.map((n) =>
          !ids || ids.includes(n.id) ? { ...n, read: true } : n,
        ),
      )
    } catch { /* silent */ }
  }, [address])

  const unreadCount = notifications.filter((n) => !n.read).length

  return { notifications, unreadCount, markRead, refresh: fetch_ }
}
