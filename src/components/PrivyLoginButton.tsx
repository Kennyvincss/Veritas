/**
 * PrivyLoginButton — replaces ConnectKitButton throughout the app.
 *
 * When Privy is configured: shows a Login / user pill button.
 * When Privy is not configured (no App ID): shows a "Set up login" notice.
 */

import { usePrivyAccount } from '@/hooks/usePrivyAccount'
import { formatAddress } from '@/lib/utils'
import { LogOut } from 'lucide-react'

interface PrivyLoginButtonProps {
  /** 'nav' = compact dark style for top nav; 'light' = light surface for inner header */
  variant?: 'nav' | 'light'
  onProfileClick?: () => void
}

export function PrivyLoginButton({ variant = 'nav', onProfileClick }: PrivyLoginButtonProps) {
  const { isConnected, address, displayName, avatarUrl, login, logout, isPrivy } = usePrivyAccount()

  if (!isPrivy) {
    // No Privy App ID — show a muted notice
    return (
      <span
        className="px-3 py-1.5 rounded-lg text-xs font-500 border"
        style={{
          color: variant === 'nav' ? 'var(--nav-muted)' : 'var(--subtle)',
          borderColor: variant === 'nav' ? 'var(--nav-border)' : 'var(--border)',
          background: 'transparent',
        }}
      >
        Set VITE_PRIVY_APP_ID
      </span>
    )
  }

  if (!isConnected) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-600 transition-colors min-h-[36px]"
        style={
          variant === 'nav'
            ? { background: 'var(--cta)', color: '#fff' }
            : { background: 'var(--cta)', color: '#fff' }
        }
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cta-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cta)')}
      >
        Sign in
      </button>
    )
  }

  // Connected — show avatar / initial + name + logout
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : '??'

  const label = displayName ?? (address ? formatAddress(address) : '')

  return (
    <div className="flex items-center gap-1.5">
      {/* Profile pill */}
      <button
        onClick={onProfileClick}
        className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl transition-colors"
        style={
          variant === 'nav'
            ? { background: 'rgba(255,255,255,0.08)' }
            : { background: 'var(--surface-muted)', border: '1px solid var(--border)' }
        }
        onMouseEnter={(e) =>
          (e.currentTarget.style.background =
            variant === 'nav' ? 'rgba(255,255,255,0.14)' : 'var(--surface)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background =
            variant === 'nav' ? 'rgba(255,255,255,0.08)' : 'var(--surface-muted)')
        }
        title="My profile"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={label}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-700"
            style={{ background: 'var(--cta)', color: '#fff' }}
          >
            {initials}
          </div>
        )}
        <span
          className="text-xs font-500 max-w-[100px] truncate"
          style={{ color: variant === 'nav' ? 'var(--nav-ink)' : 'var(--ink)' }}
        >
          {label}
        </span>
      </button>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: variant === 'nav' ? 'var(--nav-muted)' : 'var(--subtle)' }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background =
            variant === 'nav' ? 'rgba(255,255,255,0.08)' : 'var(--surface-muted)')
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Sign out"
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
