/**
 * MarketplacePage — Jobsync-inspired 3-panel layout.
 *
 * [Left: filter sidebar] [Center: search hero + card grid] [Right: detail panel]
 *
 * Clicking a card opens the detail panel on desktop; on mobile it calls onSelectBounty
 * which navigates to the full BountyDetailPage.
 */
import { Search, Plus, Loader2, AlertCircle, ExternalLink, Clock, ChevronDown, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { TokenUSDC } from '@web3icons/react'
import { BountyCard } from './BountyCard'
import { BountyStatusBadge } from './StatusBadge'
import { UserAvatar } from './UserAvatar'
import { useProfiles } from '@/hooks/useProfiles'
import { formatAddress, formatUsdcAmount, timeRemaining, formatDate } from '@/lib/utils'
import { ARC_TESTNET_CHAIN_ID, isArcChain, getExplorerBase } from '@/contracts/VeritasEscrow'
import type { Bounty } from '@/types/bounty'
import type { Submission } from '@/types/bounty'
import type { UserRole } from '@/hooks/useRole'

interface MarketplacePageProps {
  bounties: Bounty[]
  submissions: Submission[]
  isLoading: boolean
  error: Error | null
  onSelectBounty: (id: string) => void
  onNavigate: (view: string) => void
  onRefresh: () => void
  onProfileClick?: (address: string) => void
  role?: UserRole | null
}

type SortOption = 'newest' | 'reward_high' | 'deadline_soon' | 'my_submissions'

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'newest',        label: 'Newest first' },
  { id: 'reward_high',   label: 'Highest reward' },
  { id: 'deadline_soon', label: 'Deadline soon' },
  { id: 'my_submissions', label: 'My submissions' },
]

const STATUS_FILTERS = [
  { id: 'all',       label: 'All Jobs' },
  { id: 'open',      label: 'Open' },
  { id: 'in_review', label: 'In Review' },
  { id: 'completed', label: 'Completed' },
] as const

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  bounty,
  chainId,
  submissions,
  onOpenFull,
  onClose,
  onProfileClick,
}: {
  bounty: Bounty
  chainId: number
  submissions: Submission[]
  onOpenFull: () => void
  onClose: () => void
  onProfileClick?: (address: string) => void
}) {
  const { getProfile } = useProfiles()
  const ownerProfile = getProfile(bounty.owner)
  const remaining = timeRemaining(bounty.deadline)
  const isExpired = remaining === 'Expired'
  const explorer = getExplorerBase(chainId)
  const subCount = submissions.filter((s) => s.bountyId === bounty.id).length

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--surface)' }}
    >
      {/* Panel header image-style banner */}
      <div
        className="relative h-40 shrink-0 flex items-end p-4"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #111827 100%)',
        }}
      >
        {/* Close (mobile) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
        >
          <X size={15} />
        </button>

        {/* Creator avatar */}
        <button
          onClick={() => onProfileClick?.(bounty.owner)}
          className="absolute bottom-4 right-4"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          <div
            className="w-14 h-14 rounded-2xl border-2"
            style={{ borderColor: '#fff', overflow: 'hidden' }}
          >
            <UserAvatar
              address={bounty.owner}
              avatarUrl={ownerProfile?.avatarUrl}
              displayName={ownerProfile?.displayName}
              size={56}
            />
          </div>
        </button>

        <div>
          <h2
            className="display font-700 text-lg leading-tight"
            style={{ color: '#fff', letterSpacing: '-0.02em', maxWidth: 240 }}
          >
            {bounty.title}
          </h2>
          <button
            onClick={() => onProfileClick?.(bounty.owner)}
            className="text-xs mt-0.5 hover:underline"
            style={{ color: 'var(--cta)', background: 'none', border: 'none', padding: 0 }}
          >
            {ownerProfile?.displayName ?? formatAddress(bounty.owner)}
          </button>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-px border-b" style={{ borderColor: 'var(--border)' }}>
        {[
          {
            label: 'Reward',
            value: (
              <div className="flex items-center gap-1">
                <TokenUSDC variant="branded" size={14} />
                <span className="display font-700 tabular-nums" style={{ color: 'var(--ink)' }}>
                  {formatUsdcAmount(bounty.rewardRaw, chainId)}
                </span>
              </div>
            ),
          },
          {
            label: 'Status',
            value: <BountyStatusBadge status={bounty.status} />,
          },
          {
            label: 'Deadline',
            value: (
              <span className={isExpired ? 'text-red-600' : ''} style={{ color: isExpired ? 'var(--danger)' : 'var(--ink)' }}>
                {formatDate(bounty.deadline)}
              </span>
            ),
          },
          {
            label: 'Submissions',
            value: <span style={{ color: 'var(--ink)' }}>{subCount}</span>,
          },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {label}
            </p>
            <div className="text-sm font-500">{value}</div>
          </div>
        ))}
      </div>

      {/* Time remaining chip */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <Clock size={12} style={{ color: isExpired ? 'var(--danger)' : 'var(--subtle)' }} />
          <span className="text-xs" style={{ color: isExpired ? 'var(--danger)' : 'var(--subtle)' }}>
            {isExpired ? 'Expired' : `${remaining} remaining`}
          </span>
          {bounty.txHash && (
            <a
              href={`${explorer}/tx/${bounty.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs"
              style={{ color: 'var(--subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={11} />
              Explorer
            </a>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pt-3">
        <p className="text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Description
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          {bounty.description.slice(0, 400)}
          {bounty.description.length > 400 && (
            <button
              onClick={onOpenFull}
              className="ml-1 font-600 hover:underline"
              style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0 }}
            >
              View more…
            </button>
          )}
        </p>
      </div>

      {/* CTAs */}
      <div className="px-4 pt-4 pb-5 mt-auto flex flex-col gap-2">
        <button
          onClick={onOpenFull}
          className="w-full py-3 rounded-xl text-sm font-600"
          style={{ background: 'var(--cta)', color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cta-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cta)')}
        >
          View full details &amp; submit
        </button>
        {bounty.txHash && (
          <a
            href={`${explorer}/address/${bounty.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl text-xs font-600 text-center border"
            style={{
              color: 'var(--muted)',
              borderColor: 'var(--border)',
              display: 'block',
            }}
          >
            Other jobs from this creator
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarketplacePage({
  bounties,
  submissions,
  isLoading,
  error,
  onSelectBounty,
  onNavigate,
  onRefresh,
  onProfileClick,
  role,
}: MarketplacePageProps) {
  const isCreator = role === 'creator'
  const { address, chainId } = useAccount()
  const displayChainId = chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Memoize: job IDs that the connected user has submitted to
  const mySubmittedBountyIds = useMemo(
    () =>
      new Set(
        submissions
          .filter((s) => address && s.contributor.toLowerCase() === address.toLowerCase())
          .map((s) => s.bountyId),
      ),
    [submissions, address],
  )

  // Memoize: filter + sort
  const filtered = useMemo(() => {
    const base = bounties.filter((b) => {
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      const q = query.toLowerCase()
      const matchQuery = !query || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
      return matchStatus && matchQuery
    })
    return [...base].sort((a, b) => {
      switch (sortBy) {
        case 'reward_high': return b.rewardRaw > a.rewardRaw ? 1 : b.rewardRaw < a.rewardRaw ? -1 : 0
        case 'deadline_soon': return a.deadline - b.deadline
        case 'my_submissions': {
          const aS = mySubmittedBountyIds.has(a.id) ? 0 : 1
          const bS = mySubmittedBountyIds.has(b.id) ? 0 : 1
          if (aS !== bS) return aS - bS
          return a.deadline - b.deadline
        }
        default: return b.createdAt - a.createdAt
      }
    })
  }, [bounties, query, statusFilter, sortBy, mySubmittedBountyIds])

  const openCount = bounties.filter((b) => b.status === 'open').length
  const selectedBounty = selectedId ? bounties.find((b) => b.id === selectedId) ?? null : null

  function handleCardClick(id: string) {
    // On mobile (< md) navigate directly to full page
    if (window.innerWidth < 768) {
      onSelectBounty(id)
      return
    }
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const currentSortLabel = SORT_OPTIONS.find((s) => s.id === sortBy)?.label ?? 'Sort'

  return (
    <div className="flex h-[calc(100dvh-60px)] overflow-hidden" style={{ background: 'var(--bg-gradient)' }}>

      {/* ── Left: filter sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 h-full overflow-y-auto border-r py-5 px-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="display font-700 text-sm" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>Filter</p>
          <button
            onClick={() => { setStatusFilter('all'); setSortBy('newest') }}
            className="text-xs font-600"
            style={{ color: '#dc2626' }}
          >
            Reset
          </button>
        </div>

        {/* Status filter */}
        <div className="mb-6">
          <p className="text-xs font-600 mb-3" style={{ color: 'var(--ink)', letterSpacing: '0.01em' }}>
            Bounty Status
          </p>
          <div className="flex flex-col gap-2">
            {STATUS_FILTERS.map((f) => (
              <label key={f.id} className="flex items-center gap-2.5 cursor-pointer group">
                <span
                  className="w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors"
                  style={{
                    borderColor: statusFilter === f.id ? 'var(--cta)' : 'var(--border-strong)',
                    background: statusFilter === f.id ? 'var(--cta)' : 'transparent',
                  }}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {statusFilter === f.id && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span
                  className="text-sm cursor-pointer"
                  style={{ color: statusFilter === f.id ? 'var(--ink)' : 'var(--muted)' }}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="mb-6">
          <p className="text-xs font-600 mb-3" style={{ color: 'var(--ink)', letterSpacing: '0.01em' }}>
            Sort By
          </p>
          <div className="flex flex-col gap-2">
            {SORT_OPTIONS.map((s) => (
              <label key={s.id} className="flex items-center gap-2.5 cursor-pointer">
                <span
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ borderColor: sortBy === s.id ? 'var(--cta)' : 'var(--border-strong)' }}
                  onClick={() => setSortBy(s.id)}
                >
                  {sortBy === s.id && (
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--cta)' }} />
                  )}
                </span>
                <span
                  className="text-sm cursor-pointer"
                  style={{ color: sortBy === s.id ? 'var(--ink)' : 'var(--muted)' }}
                  onClick={() => setSortBy(s.id)}
                >
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          className="mt-auto rounded-xl p-3 border"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Live Stats
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>Total bounties</span>
              <span className="font-600" style={{ color: 'var(--ink)' }}>{bounties.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>Open now</span>
              <span className="font-600" style={{ color: 'var(--cta)' }}>{openCount}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Center: search + grid ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Hero search banner */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div
            className="rounded-2xl px-5 py-4 mb-4"
            style={{
              background: 'linear-gradient(135deg, #e8eaf8 0%, #dde1f5 100%)',
              border: '1px solid rgba(99,102,241,0.12)',
            }}
          >
            <h1 className="display font-700 text-xl mb-0.5" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              {isCreator ? 'Post a job, get it done.' : 'Find your ideal job right here!'}
            </h1>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              {isCreator
                ? 'Browse the marketplace for inspiration, then post your own bounty.'
                : 'Explore opportunities and get paid in USDC on Arc.'}
            </p>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
              <input
                type="text"
                placeholder="Search bounties…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-12 py-2.5 rounded-xl text-sm border outline-none"
                style={{ background: 'var(--surface)', borderColor: 'rgba(99,102,241,0.18)', color: 'var(--ink)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)')}
              />
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--cta)', color: '#fff' }}
                title="Refresh from chain"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
            </div>
          </div>

          {/* Toolbar row */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-600" style={{ color: 'var(--ink)' }}>
              {isLoading
                ? 'Loading…'
                : `${filtered.length} Bount${filtered.length === 1 ? 'y' : 'ies'} Found`}
            </p>

            <div className="flex items-center gap-2">
              {/* Mobile status filter chips */}
              <div className="flex lg:hidden items-center gap-1 overflow-x-auto">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className="px-2.5 py-1 rounded-full text-xs font-600 whitespace-nowrap shrink-0"
                    style={{
                      background: statusFilter === f.id ? 'var(--cta)' : 'var(--surface)',
                      color: statusFilter === f.id ? '#fff' : 'var(--muted)',
                      border: `1px solid ${statusFilter === f.id ? 'var(--cta)' : 'var(--border)'}`,
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-500"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                  {currentSortLabel}
                  <ChevronDown size={12} />
                </button>
                {showSortMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 w-44 rounded-xl border py-1 z-20"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
                  >
                    {SORT_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSortBy(s.id); setShowSortMenu(false) }}
                        className="w-full text-left px-3 py-2 text-xs font-500 transition-colors"
                        style={{
                          background: sortBy === s.id ? 'var(--surface-muted)' : 'transparent',
                          color: sortBy === s.id ? 'var(--cta)' : 'var(--muted)',
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onNavigate('create')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600"
                style={{ background: 'var(--ink)', color: '#fff' }}
              >
                <Plus size={12} />
                Post Job
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mx-5 mb-3 flex items-start gap-2 p-3 rounded-xl border"
            style={{ background: 'var(--danger-bg)', borderColor: 'rgba(220,38,38,0.2)' }}
          >
            <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{error.message}</p>
          </div>
        )}

        {/* Card grid — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Loading skeleton */}
          {isLoading && bounties.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-4 animate-pulse"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', minHeight: 140 }}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-20 rounded-2xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="display font-600 text-base mb-1" style={{ color: 'var(--ink)' }}>No jobs found</p>
              <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
                {query
                  ? 'Try a different search or filter.'
                  : isCreator
                  ? 'No jobs yet. Be the first to post one.'
                  : 'No jobs posted yet. Check back soon — new opportunities are added regularly.'}
              </p>
              {!query && isCreator && (
                <button
                  onClick={() => onNavigate('create')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600"
                  style={{ background: 'var(--cta)', color: '#fff' }}
                >
                  <Plus size={14} />
                  Post the first bounty
                </button>
              )}
              {!query && !isCreator && (
                <button
                  onClick={() => onNavigate('post_gig')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600"
                  style={{ background: 'var(--cta-soft)', color: 'var(--cta)' }}
                >
                  Post your gig while you wait
                </button>
              )}
            </div>
          )}

          {/* Grid */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((b) => (
                <BountyCard
                  key={b.id}
                  bounty={b}
                  onClick={handleCardClick}
                  onProfileClick={onProfileClick}
                  hasMySubmission={mySubmittedBountyIds.has(b.id)}
                  selected={selectedId === b.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Right: detail panel ───────────────────────────────────────────── */}
      {selectedBounty && (
        <aside
          className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 h-full border-l overflow-hidden"
          style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-panel)' }}
        >
          <DetailPanel
            bounty={selectedBounty}
            chainId={displayChainId}
            submissions={submissions}
            onOpenFull={() => onSelectBounty(selectedBounty.id)}
            onClose={() => setSelectedId(null)}
            onProfileClick={onProfileClick}
          />
        </aside>
      )}
    </div>
  )
}
