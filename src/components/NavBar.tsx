/**
 * NavBar — Jobsync-inspired dark horizontal top bar, role-aware.
 *
 * Desktop: sticky dark top bar — logo left, nav links center, role badge + icons + wallet right.
 * Mobile: same bar collapsed; bottom tab bar for primary navigation.
 *
 * Creator nav:    Explore · Post Job · Dashboard · Leaderboard
 * Freelancer nav: Explore · Dashboard · Leaderboard   (+ Switch to Creator pill)
 */
import { BarChart2, Home, PlusSquare, User, ArrowLeftRight, MessageSquare, ShoppingBag } from 'lucide-react'
import { usePrivyAccount } from '@/hooks/usePrivyAccount'
import { PrivyLoginButton } from './PrivyLoginButton'
import { NotificationBell } from './NotificationBell'
import { cn, formatAddress } from '@/lib/utils'
import { VeriPayLogo } from './VeriPayLogo'
import type { UserRole } from '@/hooks/useRole'

interface NavBarProps {
  currentView: string
  onNavigate: (view: string) => void
  effectiveRole: UserRole | null
  isSwitchedToCreator: boolean
  onSwitchToCreator: () => void
  onSwitchBackToFreelancer: () => void
  onBountyNotifClick?: (bountyId: string) => void
}

export function NavBar({
  currentView,
  onNavigate,
  effectiveRole,
  isSwitchedToCreator,
  onSwitchToCreator,
  onSwitchBackToFreelancer,
  onBountyNotifClick,
}: NavBarProps) {
  const { address, isConnected } = usePrivyAccount()

  const isCreator = effectiveRole === 'creator'

  const NAV_LINKS = isCreator
    ? [
        { id: 'gigs', label: 'Browse Freelancers' },
        { id: 'marketplace', label: 'Jobs' },
        { id: 'create', label: 'Post Job' },
        { id: 'orders', label: 'Orders' },
        { id: 'messages', label: 'Messages' },
        { id: 'dashboard', label: 'Dashboard' },
      ]
    : [
        { id: 'marketplace', label: 'Find Jobs' },
        { id: 'post_gig', label: 'Post a Gig' },
        { id: 'orders', label: 'Orders' },
        { id: 'messages', label: 'Messages' },
        { id: 'dashboard', label: 'My Work' },
      ]

  const MOBILE_ITEMS = isCreator
    ? [
        { id: 'gigs', label: 'Freelancers', icon: User },
        { id: 'create', label: 'Post', icon: PlusSquare },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
      ]
    : [
        { id: 'marketplace', label: 'Jobs', icon: Home },
        { id: 'post_gig', label: 'Post Gig', icon: PlusSquare },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'dashboard', label: 'My Work', icon: BarChart2 },
      ]

  function handleProfileNav() {
    if (address) onNavigate(`profile:${address}`)
  }

  return (
    <>
      {/* ── Desktop top bar ──────────────────────────────────────────────── */}
      <header
        className="hidden md:flex sticky top-0 z-40 items-center justify-between px-6 h-[60px] border-b"
        style={{
          background: 'var(--nav-bg)',
          borderColor: 'var(--nav-border)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2.5 shrink-0"
        >
          <VeriPayLogo size={32} />
          <span
            className="display font-700 text-base"
            style={{ color: 'var(--nav-ink)', letterSpacing: '-0.03em' }}
          >
            VERIPAY
          </span>
        </button>

        {/* Center nav links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ id, label }) => {
            const active = currentView === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="px-3.5 py-2 rounded-lg text-sm font-500 transition-colors"
                style={{
                  color: active ? '#fff' : 'var(--nav-muted)',
                  background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = 'var(--nav-muted)'
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>

        {/* Right: role badge, switch button, icons, wallet */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Role badge */}
          {effectiveRole && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-600 border"
              style={{
                background: isCreator ? 'rgba(29,78,216,0.15)' : 'rgba(124,58,237,0.15)',
                borderColor: isCreator ? 'rgba(29,78,216,0.3)' : 'rgba(124,58,237,0.3)',
                color: isCreator ? '#93c5fd' : '#c4b5fd',
              }}
            >
              {isSwitchedToCreator ? 'Creator mode' : isCreator ? 'Creator' : 'Freelancer'}
            </span>
          )}

          {/* Switch to Creator / Switch Back button */}
          {effectiveRole === 'freelancer' && !isSwitchedToCreator && (
            <button
              onClick={onSwitchToCreator}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 border transition-colors"
              style={{
                borderColor: 'rgba(29,78,216,0.35)',
                color: '#93c5fd',
                background: 'rgba(29,78,216,0.1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(29,78,216,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(29,78,216,0.1)')}
              title="Temporarily switch to Creator mode to post bounties"
            >
              <ArrowLeftRight size={12} />
              Switch to Creator
            </button>
          )}
          {isSwitchedToCreator && (
            <button
              onClick={onSwitchBackToFreelancer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 border transition-colors"
              style={{
                borderColor: 'rgba(124,58,237,0.35)',
                color: '#c4b5fd',
                background: 'rgba(124,58,237,0.1)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.1)')}
            >
              <ArrowLeftRight size={12} />
              Back to Freelancer
            </button>
          )}

          {isConnected && (
            <NotificationBell address={address} onBountyClick={onBountyNotifClick} />
          )}
          <PrivyLoginButton
            variant="nav"
            onProfileClick={isConnected && address ? handleProfileNav : undefined}
          />
        </div>
      </header>

      {/* ── Mobile bottom bar ────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{
          background: 'var(--nav-bg)',
          borderColor: 'var(--nav-border)',
          boxShadow: '0 -2px 12px rgba(17,24,39,0.15)',
        }}
      >
        {/* Connect row */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: 'var(--nav-border)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--nav-muted)' }}>
              {isConnected && address ? formatAddress(address) : 'Connect wallet'}
            </span>
            {/* Mobile switch button */}
            {effectiveRole === 'freelancer' && !isSwitchedToCreator && (
              <button
                onClick={onSwitchToCreator}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-600 border"
                style={{ borderColor: 'rgba(29,78,216,0.3)', color: '#93c5fd', background: 'rgba(29,78,216,0.1)' }}
              >
                <ArrowLeftRight size={10} />
                Creator mode
              </button>
            )}
            {isSwitchedToCreator && (
              <button
                onClick={onSwitchBackToFreelancer}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-600 border"
                style={{ borderColor: 'rgba(124,58,237,0.3)', color: '#c4b5fd', background: 'rgba(124,58,237,0.1)' }}
              >
                <ArrowLeftRight size={10} />
                Freelancer
              </button>
            )}
          </div>
          <PrivyLoginButton variant="nav" />
        </div>
        {/* Nav items */}
        <div className="flex items-center h-14">
          {MOBILE_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = currentView === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors',
                )}
                style={{ color: active ? 'var(--cta)' : 'var(--nav-muted)' }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span className="text-[10px] font-500">{label}</span>
              </button>
            )
          })}
          {isConnected && address && (
            <button
              onClick={handleProfileNav}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
              style={{ color: currentView === 'profile' ? 'var(--cta)' : 'var(--nav-muted)' }}
            >
              <User size={18} strokeWidth={currentView === 'profile' ? 2.2 : 1.8} />
              <span className="text-[10px] font-500">Profile</span>
            </button>
          )}
        </div>
      </nav>
    </>
  )
}
