import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useNotifications, type AppNotification } from '@/hooks/useNotifications'
import { formatDate } from '@/lib/utils'

interface NotificationBellProps {
  address: string | undefined
  onBountyClick?: (bountyId: string) => void
}

const TYPE_COLORS: Record<AppNotification['type'], string> = {
  new_submission: 'var(--accent)',
  status_update: '#f59e0b',
  payment_released: 'var(--success)',
  bounty_cancelled: 'var(--danger)',
}

export function NotificationBell({ address, onBountyClick }: NotificationBellProps) {
  const { notifications, unreadCount, markRead } = useNotifications(address)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) void markRead()
  }

  if (!address) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
        style={{
          background: open ? 'var(--surface-muted)' : 'transparent',
          color: 'var(--muted)',
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-700 px-1"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-80 rounded-2xl border shadow-xl z-50 overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-sm font-600" style={{ color: 'var(--ink)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => void markRead()}
                className="text-xs"
                style={{ color: 'var(--accent)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="mx-auto mb-2" style={{ color: 'var(--subtle)' }} />
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false)
                    onBountyClick?.(n.bountyId)
                  }}
                  className="w-full text-left px-4 py-3 border-b flex gap-3 items-start transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    background: n.read ? 'transparent' : 'rgba(29,78,216,0.04)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(29,78,216,0.04)')}
                >
                  <span
                    className="mt-0.5 shrink-0 w-2 h-2 rounded-full"
                    style={{ background: n.read ? 'transparent' : TYPE_COLORS[n.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-600 mb-0.5 truncate" style={{ color: 'var(--ink)' }}>
                      {n.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                      {n.message}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--subtle)' }}>
                      {formatDate(Math.floor(n.createdAt / 1000))}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
