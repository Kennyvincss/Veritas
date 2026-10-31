/**
 * VERIPAY — Onchain Bounty Platform
 * CityPay-inspired light UI: lavender canvas, white cards, sidebar icon nav.
 */

import { useState, useCallback, useEffect } from 'react'
import { usePrivyAccount } from './hooks/usePrivyAccount'
import { PrivyLoginButton } from './components/PrivyLoginButton'
import { NavBar } from './components/NavBar'
import { RoleSelectPage } from './components/RoleSelectPage'
import { LandingPage } from './components/LandingPage'
import { MarketplacePage } from './components/MarketplacePage'
import { CreateBountyPage } from './components/CreateBountyPage'
import { DashboardPage } from './components/DashboardPage'
import { BountyDetailPage } from './components/BountyDetailPage'
import { ProfilePage } from './components/ProfilePage'
import { LeaderboardPage } from './components/LeaderboardPage'
import { ReceiptVerifyPage } from './components/ReceiptVerifyPage'
import { PostGigPage } from './components/PostGigPage'
import { GigsMarketplace } from './components/GigsMarketplace'
import { MessagesPage } from './components/MessagesPage'
import { OrdersPage } from './components/OrdersPage'
import { OrderGigModal } from './components/OrderGigModal'
import { useOnchainBounties } from './hooks/useOnchainBounties'
import { useServerSubmissions } from './hooks/useServerSubmissions'
import { useArcNetwork } from './hooks/useArcNetwork'
import { usePlatformStats } from './hooks/usePlatformStats'
import { useRole } from './hooks/useRole'
import { AlertTriangle } from 'lucide-react'
import { VeriPayLogo } from './components/VeriPayLogo'
import type { Bounty } from './types/bounty'
import type { Gig } from './types/gig'

type View =
  | 'landing'
  | 'marketplace'
  | 'create'
  | 'dashboard'
  | 'bounty_detail'
  | 'profile'
  | 'leaderboard'
  | 'receipt_verify'
  | 'howitworks'
  | 'post_gig'
  | 'gigs'
  | 'messages'
  | 'orders'

// Banner shown when wallet is on Arc Mainnet before the contract is deployed there,
// or as a persistent reminder that the user is on a live network with real funds.
function NetworkBanner() {
  const { isMainnet, isOnArc, escrowNotDeployed, switchToTestnet } = useArcNetwork()

  if (!isOnArc) return null

  if (escrowNotDeployed) {
    return (
      <div
        className="flex items-start gap-3 px-5 py-3 border-b text-sm"
        style={{ background: '#fef9e7', borderColor: '#f6d55c', color: '#7a5c00' }}
      >
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="font-600">Contract not yet deployed on Arc Mainnet.</span>
          {' '}Bounty creation and funding are unavailable on this network.
          {' '}
          <button
            onClick={switchToTestnet}
            className="underline font-600"
            style={{ color: '#7a5c00' }}
          >
            Switch to Arc Testnet
          </button>
        </div>
      </div>
    )
  }

  if (isMainnet) {
    return (
      <div
        className="flex items-center gap-2.5 px-5 py-2.5 border-b text-xs font-500"
        style={{ background: '#fdf2f8', borderColor: '#f0abdc', color: '#7c3c6a' }}
      >
        <AlertTriangle size={13} className="flex-shrink-0" />
        <span>
          <span className="font-700">Arc Mainnet</span> — transactions involve real USDC and are irreversible. Verify all details before signing.
        </span>
      </div>
    )
  }

  return null
}

// View title map
const VIEW_TITLES: Record<string, string> = {
  marketplace: 'Job Marketplace',
  create: 'Post a Job',
  dashboard: 'Dashboard',
  bounty_detail: 'Job Details',
  profile: 'Profile',
  leaderboard: 'Leaderboard',
  receipt_verify: 'Receipt Verification',
  post_gig: 'Post a Gig',
  gigs: 'Browse Freelancers',
}

// Top header shown on inner pages (matches CityPay's top bar)
function InnerHeader({
  title,
  onNavigate,
}: {
  title: string
  onNavigate: (v: string) => void
}) {
  const { displayName, isConnected } = usePrivyAccount()

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-6 h-16 border-b"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 1px 6px rgba(26,46,74,0.04)',
      }}
    >
      {/* Brand (mobile only) */}
      <button
        onClick={() => onNavigate('landing')}
        className="flex items-center gap-2 md:hidden"
      >
        <VeriPayLogo size={28} />
        <span className="display font-700 text-base" style={{ color: 'var(--ink)' }}>
          VERIPAY
        </span>
      </button>

      {/* Page title — desktop */}
      <p
        className="hidden md:block display font-600 text-base"
        style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
      >
        {title}
      </p>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {isConnected && displayName && (
          <span
            className="hidden sm:block text-sm"
            style={{ color: 'var(--muted)' }}
          >
            {displayName}
          </span>
        )}
        <div className="md:hidden">
          <PrivyLoginButton variant="light" />
        </div>
      </div>
    </div>
  )
}

export default function App({ privyReady: _privyReady }: { privyReady?: boolean }) {
  // Lazy-initialize view from URL params so ?receipt= deep-links work immediately
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('receipt')) return 'receipt_verify'
    if (params.get('gig')) return 'gigs'
    return 'landing'
  })
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null)
  const [profileAddress, setProfileAddress] = useState<string | null>(null)
  const [messagePartner, setMessagePartner] = useState<string | undefined>(undefined)
  const [orderingGig, setOrderingGig] = useState<Gig | null>(null)
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('receipt')
  })

  const { isConnected, address } = usePrivyAccount()
  const {
    role,
    effectiveRole,
    isSwitchedToCreator,
    chooseRole,
    switchToCreator,
    switchBackToFreelancer,
  } = useRole()

  const { bounties, isLoading, error, refetch } = useOnchainBounties()
  const submissionsApi = useServerSubmissions()
  const stats = usePlatformStats(bounties, submissionsApi.submissions)

  function openMessages(partner?: string) {
    setMessagePartner(partner)
    setView('messages')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function navigate(v: string, addr?: string) {
    // NavBar emits 'profile:<address>' as a shortcut
    if (v.startsWith('profile:')) {
      const navAddr = v.slice('profile:'.length)
      if (navAddr) openProfile(navAddr)
      return
    }
    // 'messages:<address>' opens messages with a specific partner
    if (v.startsWith('messages:')) {
      const partner = v.slice('messages:'.length)
      openMessages(partner || undefined)
      return
    }
    // 'howitworks' is not a separate page — go to landing and scroll to the section
    if (v === 'howitworks') {
      setView('landing')
      setSelectedBountyId(null)
      setProfileAddress(null)
      // Defer scroll until after render
      setTimeout(() => {
        const el = document.getElementById('how-it-works')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 80)
      return
    }
    setView(v as View)
    setSelectedBountyId(null)
    if (v !== 'profile') setProfileAddress(null)
    if (addr) setProfileAddress(addr)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openBounty(id: string) {
    setSelectedBountyId(id)
    setView('bounty_detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openProfile(address: string) {
    setProfileAddress(address)
    setView('profile')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openReceipt(receiptId: string) {
    setSelectedReceiptId(receiptId)
    setView('receipt_verify')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBountyCreated = useCallback(() => { refetch() }, [refetch])

  const selectedBounty: Bounty | null = selectedBountyId
    ? (bounties.find((b) => b.id === selectedBountyId) ?? null)
    : null

  const bountySubmissions = selectedBountyId
    ? submissionsApi.forBounty(selectedBountyId)
    : []

  // Update document title to reflect current view
  useEffect(() => {
    const titles: Record<string, string> = {
      landing: 'VERIPAY — Onchain Bounty Platform',
      marketplace: 'Job Marketplace — VERIPAY',
      create: 'Post a Job — VERIPAY',
      dashboard: 'Dashboard — VERIPAY',
      bounty_detail: selectedBounty ? `${selectedBounty.title} — VERIPAY` : 'Bounty — VERIPAY',
      profile: 'Profile — VERIPAY',
      leaderboard: 'Leaderboard — VERIPAY',
      receipt_verify: 'Receipt Verification — VERIPAY',
    }
    document.title = titles[view] ?? 'VERIPAY'
  }, [view, selectedBounty])

  // Role select — shown when wallet is connected but no role chosen yet
  // (intercepts any non-landing view, including deep-linked receipt_verify)
  if (isConnected && role === null && view !== 'landing') {
    return <RoleSelectPage onChoose={chooseRole} />
  }

  // Landing — full-width, no sidebar
  if (view === 'landing') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-gradient)' }}>
        <header
          className="sticky top-0 z-40 border-b flex items-center justify-between px-6 h-[60px]"
          style={{
            background: 'var(--nav-bg)',
            borderColor: 'var(--nav-border)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <VeriPayLogo size={32} />
            <span className="display font-700 text-base" style={{ color: 'var(--nav-ink)', letterSpacing: '-0.03em' }}>
              VERIPAY
            </span>
          </div>
          <nav className="flex items-center gap-1 flex-wrap">
            {[
              { label: 'Explore', view: 'marketplace' },
              { label: 'How It Works', view: 'howitworks' },
              { label: 'Leaderboard', view: 'leaderboard' },
            ].map(({ label, view: v }) => (
              <button
                key={v}
                onClick={() => navigate(v)}
                className="px-3 py-2 rounded-lg text-sm font-500 transition-colors hidden sm:block"
                style={{ color: 'var(--nav-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--nav-muted)')}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => navigate('create')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-600"
              style={{ background: 'var(--cta)', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cta-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cta)')}
            >
              Post Job
            </button>
            <PrivyLoginButton variant="nav" />
          </nav>
        </header>
        <LandingPage
          onNavigate={(v, addr) => addr ? openProfile(addr) : navigate(v)}
          bounties={bounties}
          submissions={submissionsApi.submissions}
          stats={stats}
          isLoading={isLoading}
          onSelectBounty={openBounty}
        />
      </div>
    )
  }

  // Inner views — top-bar layout (no sidebar offset; NavBar is now a top bar)
  const title = VIEW_TITLES[view] ?? 'VERIPAY'
  // Marketplace has its own full-height layout — hide the InnerHeader there
  const showInnerHeader = view !== 'marketplace' && view !== 'gigs' && view !== 'messages' && view !== 'orders'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-gradient)' }}>
      <NavBar
        currentView={view}
        onNavigate={navigate}
        effectiveRole={effectiveRole}
        isSwitchedToCreator={isSwitchedToCreator}
        onSwitchToCreator={switchToCreator}
        onSwitchBackToFreelancer={switchBackToFreelancer}
        onBountyNotifClick={openBounty}
      />

      {/* pb accounts for the two-row mobile bottom nav (~96px total) */}
      <div className="md:pb-0 pb-24">
        {showInnerHeader && <InnerHeader title={title} onNavigate={navigate} />}
        <NetworkBanner />
        <main>
            {view === 'marketplace' && (
              <MarketplacePage
                bounties={bounties}
                submissions={submissionsApi.submissions}
                isLoading={isLoading}
                error={error}
                onSelectBounty={openBounty}
                onNavigate={navigate}
                onRefresh={refetch}
                onProfileClick={openProfile}
                role={effectiveRole}
              />
            )}

            {view === 'create' && (
              <CreateBountyPage
                onNavigate={navigate}
                onBountyCreated={handleBountyCreated}
              />
            )}

            {view === 'post_gig' && (
              <PostGigPage
                onNavigate={navigate}
                onGigPosted={() => {}}
              />
            )}

            {view === 'gigs' && (
              <GigsMarketplace
                onNavigate={navigate}
                myAddress={address ?? undefined}
                onOrderGig={(gig) => setOrderingGig(gig)}
              />
            )}

            {view === 'dashboard' && (
              <DashboardPage
                bounties={bounties}
                submissions={submissionsApi.submissions}
                onNavigate={navigate}
                onSelectBounty={openBounty}
                onViewReceipt={openReceipt}
                onProfileClick={openProfile}
                role={effectiveRole}
              />
            )}

            {view === 'bounty_detail' && selectedBounty && (
              <BountyDetailPage
                bounty={selectedBounty}
                submissions={bountySubmissions}
                submissionsApi={submissionsApi}
                onBack={() => navigate('marketplace')}
                onRefresh={refetch}
                onProfileClick={openProfile}
              />
            )}

            {view === 'bounty_detail' && !selectedBounty && (
              <div className="mx-auto max-w-xl px-4 py-20 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {isLoading ? 'Loading bounty…' : 'Bounty not found or no longer available.'}
                </p>
                <button
                  onClick={() => navigate('marketplace')}
                  className="mt-4 px-4 py-2.5 rounded-xl text-sm font-600"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Back to Job Board
                </button>
              </div>
            )}

            {view === 'profile' && profileAddress && (
              <ProfilePage
                address={profileAddress}
                bounties={bounties}
                onBack={() => navigate('marketplace')}
                onNavigate={navigate}
                onSelectBounty={openBounty}
              />
            )}

            {view === 'profile' && !profileAddress && (
              <div className="mx-auto max-w-xl px-4 py-20 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  No profile address specified.
                </p>
                <button
                  onClick={() => navigate('marketplace')}
                  className="mt-4 px-4 py-2.5 rounded-xl text-sm font-600"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Back to Job Board
                </button>
              </div>
            )}

            {view === 'messages' && (
              <MessagesPage
                myAddress={address ?? undefined}
                initialPartner={messagePartner}
                role={effectiveRole}
                onNavigate={navigate}
              />
            )}

            {view === 'orders' && (
              <OrdersPage
                myAddress={address ?? undefined}
                role={effectiveRole}
                onNavigate={navigate}
              />
            )}

            {view === 'leaderboard' && (
              <LeaderboardPage
                bounties={bounties}
                onNavigate={(v, addr) => addr ? openProfile(addr) : navigate(v)}
              />
            )}

            {view === 'receipt_verify' && selectedReceiptId && (
              <ReceiptVerifyPage
                receiptId={selectedReceiptId}
                onBack={() => navigate('dashboard')}
                onSelectBounty={openBounty}
              />
            )}

            {view === 'receipt_verify' && !selectedReceiptId && (
              <div className="mx-auto max-w-xl px-4 py-20 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  No receipt ID specified. Please open a receipt from your Dashboard.
                </p>
                <button
                  onClick={() => navigate('dashboard')}
                  className="mt-4 px-4 py-2.5 rounded-xl text-sm font-600"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Go to Dashboard
                </button>
              </div>
            )}
        </main>
      </div>

      {/* Order Gig Modal — rendered at root level so it overlays everything */}
      {orderingGig && address && (
        <OrderGigModal
          gig={orderingGig}
          creatorAddress={address}
          onClose={() => setOrderingGig(null)}
          onSuccess={() => { setOrderingGig(null); navigate('orders') }}
        />
      )}
    </div>
  )
}
