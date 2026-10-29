/**
 * LeaderboardPage — ranked contributors and creators.
 * Rankings are derived from real on-chain bounty data and offchain submissions.
 * No fabricated statistics.
 */

import { useMemo } from 'react'
import { Trophy, Award, Star } from 'lucide-react'
import { useProfiles } from '@/hooks/useProfiles'
import { useReviews } from '@/hooks/useReviews'
import { loadAllSubmissions } from '@/hooks/useSubmissions'
import { UserAvatar } from './UserAvatar'
import { RatingSummary } from './StarRating'
import { formatAddress, formatUsdcAmount } from '@/lib/utils'
import type { Bounty } from '@/types/bounty'

interface LeaderboardPageProps {
  bounties: Bounty[]
  onNavigate: (view: string, address?: string) => void
}

interface ContributorEntry {
  address: string
  completedBounties: number
  totalEarned: bigint
  avgRating: number | null
  reviewCount: number
}

interface CreatorEntry {
  address: string
  completedBounties: number
  totalFunded: bigint
  avgRating: number | null
  reviewCount: number
}

const MEDAL_COLORS = ['#f59e0b', '#9ca3af', '#92400e']

export function LeaderboardPage({ bounties, onNavigate }: LeaderboardPageProps) {
  const { getProfile } = useProfiles()
  const reviewsApi = useReviews()
  const allSubmissions = useMemo(() => loadAllSubmissions(), [])

  // Contributor leaderboard: ranked by completed bounties, then total earned
  const contributors: ContributorEntry[] = useMemo(() => {
    const byAddress = new Map<string, ContributorEntry>()

    for (const sub of allSubmissions.filter((s) => s.status === 'paid')) {
      const addr = sub.contributor.toLowerCase()
      const bounty = bounties.find((b) => b.id === sub.bountyId)
      if (!bounty) continue

      const entry = byAddress.get(addr) ?? {
        address: sub.contributor,
        completedBounties: 0,
        totalEarned: 0n,
        avgRating: null,
        reviewCount: 0,
      }
      entry.completedBounties++
      entry.totalEarned += bounty.rewardRaw
      byAddress.set(addr, entry)
    }

    // Attach review data
    for (const [addr, entry] of byAddress) {
      entry.avgRating = reviewsApi.avgRating(addr)
      entry.reviewCount = reviewsApi.forRecipient(addr).length
    }

    return [...byAddress.values()].sort((a, b) => {
      if (b.completedBounties !== a.completedBounties)
        return b.completedBounties - a.completedBounties
      // Tie-break by total earned
      if (b.totalEarned !== a.totalEarned)
        return Number(b.totalEarned - a.totalEarned)
      return 0
    })
  }, [allSubmissions, bounties, reviewsApi])

  // Creator leaderboard: ranked by completed bounties, then total funded
  const creators: CreatorEntry[] = useMemo(() => {
    const byAddress = new Map<string, CreatorEntry>()

    for (const bounty of bounties) {
      const addr = bounty.owner.toLowerCase()
      const entry = byAddress.get(addr) ?? {
        address: bounty.owner,
        completedBounties: 0,
        totalFunded: 0n,
        avgRating: null,
        reviewCount: 0,
      }
      if (bounty.status === 'completed') entry.completedBounties++
      if (['open', 'in_review', 'completed', 'cancelled'].includes(bounty.status)) {
        entry.totalFunded += bounty.rewardRaw
      }
      byAddress.set(addr, entry)
    }

    for (const [addr, entry] of byAddress) {
      entry.avgRating = reviewsApi.avgRating(addr)
      entry.reviewCount = reviewsApi.forRecipient(addr).length
    }

    return [...byAddress.values()]
      .filter((e) => e.completedBounties > 0 || e.totalFunded > 0n)
      .sort((a, b) => {
        if (b.completedBounties !== a.completedBounties)
          return b.completedBounties - a.completedBounties
        return Number(b.totalFunded - a.totalFunded)
      })
  }, [bounties, reviewsApi])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="display font-700 text-2xl mb-2" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Leaderboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Rankings derived from verified onchain bounty completions and contributor submissions.
          All statistics reflect actual platform activity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Contributors */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} style={{ color: '#f59e0b' }} />
            <h2 className="display font-600 text-lg" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Top Contributors
            </h2>
          </div>

          {contributors.length === 0 ? (
            <EmptyBoard message="No completed bounties yet. Be the first to earn a reward." />
          ) : (
            <div className="space-y-2">
              {contributors.slice(0, 20).map((entry, idx) => {
                const profile = getProfile(entry.address)
                return (
                  <button
                    key={entry.address}
                    onClick={() => onNavigate('profile', entry.address)}
                    className="w-full text-left rounded-xl p-4 border transition-all"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0"
                        style={{
                          background: idx < 3 ? `${MEDAL_COLORS[idx]}22` : 'var(--surface-muted)',
                          color: idx < 3 ? MEDAL_COLORS[idx] : 'var(--subtle)',
                        }}
                      >
                        {idx < 3 ? <Star size={13} fill={MEDAL_COLORS[idx]} color={MEDAL_COLORS[idx]} /> : idx + 1}
                      </div>

                      <UserAvatar
                        address={entry.address}
                        avatarUrl={profile?.avatarUrl}
                        displayName={profile?.displayName}
                        size={36}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-600 text-sm truncate" style={{ color: 'var(--ink)' }}>
                          {profile?.displayName ?? formatAddress(entry.address)}
                        </p>
                        {profile?.username && (
                          <p className="text-xs" style={{ color: 'var(--subtle)' }}>@{profile.username}</p>
                        )}
                        {entry.avgRating !== null && (
                          <RatingSummary avg={entry.avgRating} count={entry.reviewCount} size={12} />
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-700 text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                          {formatUsdcAmount(entry.totalEarned, 5042002)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                          {entry.completedBounties} bounti{entry.completedBounties !== 1 ? 'es' : 'y'}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Top Creators */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="display font-600 text-lg" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Top Creators
            </h2>
          </div>

          {creators.length === 0 ? (
            <EmptyBoard message="No creators yet. Post the first bounty." />
          ) : (
            <div className="space-y-2">
              {creators.slice(0, 20).map((entry, idx) => {
                const profile = getProfile(entry.address)
                return (
                  <button
                    key={entry.address}
                    onClick={() => onNavigate('profile', entry.address)}
                    className="w-full text-left rounded-xl p-4 border transition-all"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0"
                        style={{
                          background: idx < 3 ? `${MEDAL_COLORS[idx]}22` : 'var(--surface-muted)',
                          color: idx < 3 ? MEDAL_COLORS[idx] : 'var(--subtle)',
                        }}
                      >
                        {idx < 3 ? <Star size={13} fill={MEDAL_COLORS[idx]} color={MEDAL_COLORS[idx]} /> : idx + 1}
                      </div>

                      <UserAvatar
                        address={entry.address}
                        avatarUrl={profile?.avatarUrl}
                        displayName={profile?.displayName}
                        size={36}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-600 text-sm truncate" style={{ color: 'var(--ink)' }}>
                          {profile?.displayName ?? formatAddress(entry.address)}
                        </p>
                        {profile?.username && (
                          <p className="text-xs" style={{ color: 'var(--subtle)' }}>@{profile.username}</p>
                        )}
                        {entry.avgRating !== null && (
                          <RatingSummary avg={entry.avgRating} count={entry.reviewCount} size={12} />
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-700 text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                          {formatUsdcAmount(entry.totalFunded, 5042002)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                          {entry.completedBounties} completed
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <p className="text-xs text-center mt-8" style={{ color: 'var(--subtle)' }}>
        Rankings update in real time as bounties are completed on Arc Testnet.
        All data is derived from verified contract events and off-chain submissions.
      </p>
    </div>
  )
}

function EmptyBoard({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-8 border text-center"
      style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
    >
      <Trophy size={28} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
      <p className="text-sm" style={{ color: 'var(--subtle)' }}>{message}</p>
    </div>
  )
}
