/**
 * ProfilePage — public profile for any wallet address.
 * Shows identity, reputation, work history, and reviews.
 * Owner sees an "Edit Profile" button.
 */

import { useState } from 'react'
import {
  ArrowLeft, Edit3, Globe, Twitter, Github, ExternalLink,
  Star, Award, Briefcase, Clock, CheckCircle2, BarChart2,
} from 'lucide-react'
import { useAccount } from '@/hooks/useAccount'
import { useProfiles } from '@/hooks/useProfiles'
import { useReviews } from '@/hooks/useReviews'
import { loadAllSubmissions } from '@/hooks/useSubmissions'
import { UserAvatar } from './UserAvatar'
import { StarRating, RatingSummary } from './StarRating'
import { EditProfileModal } from './EditProfileModal'
import { BountyStatusBadge } from './StatusBadge'
import { formatAddress, formatDate, formatUsdcAmount } from '@/lib/utils'
import { USDC_DECIMALS } from '@/contracts/VeritasEscrow'
import type { Bounty, Submission } from '@/types/bounty'

interface ProfilePageProps {
  address: string
  bounties: Bounty[]
  onBack: () => void
  onNavigate: (view: string, address?: string) => void
  onSelectBounty: (id: string) => void
}

type ProfileTab = 'work' | 'created' | 'reviews' | 'activity'

function formatUsdcRaw(raw: bigint): string {
  const num = Number(raw) / 10 ** USDC_DECIMALS
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ProfilePage({
  address,
  bounties,
  onBack,
  onNavigate: _onNavigate,
  onSelectBounty,
}: ProfilePageProps) {
  const { address: connectedAddress } = useAccount()
  const { getProfile } = useProfiles()
  const reviewsApi = useReviews()
  const [tab, setTab] = useState<ProfileTab>('work')
  const [showEdit, setShowEdit] = useState(false)

  const profile = getProfile(address)
  const isOwner = connectedAddress?.toLowerCase() === address.toLowerCase()

  // Derived stats — from real data only
  const allSubmissions = loadAllSubmissions()
  const mySubmissions: Submission[] = allSubmissions.filter(
    (s) => s.contributor.toLowerCase() === address.toLowerCase(),
  )
  const paidSubmissions = mySubmissions.filter((s) => s.status === 'paid')
  const activeSubmissions = mySubmissions.filter(
    (s) => s.status === 'pending' || s.status === 'under_review',
  )
  const completionRate =
    mySubmissions.length > 0
      ? Math.round((paidSubmissions.length / mySubmissions.length) * 100)
      : null

  // Bounties created by this address
  const createdBounties = bounties.filter(
    (b) => b.owner.toLowerCase() === address.toLowerCase(),
  )
  const completedCreated = createdBounties.filter((b) => b.status === 'completed')

  // Total earned (sum of completed bounty rewards where this address was paid)
  const totalEarned = paidSubmissions.reduce((sum, s) => {
    const bounty = bounties.find((b) => b.id === s.bountyId)
    return bounty ? sum + bounty.rewardRaw : sum
  }, 0n)

  // Total funded (sum of all bounty rewards created by this address, funded)
  const totalFunded = createdBounties
    .filter((b) => ['open', 'in_review', 'completed', 'cancelled'].includes(b.status))
    .reduce((sum, b) => sum + b.rewardRaw, 0n)

  // Reviews
  const receivedReviews = reviewsApi.forRecipient(address)
  const avgRating = reviewsApi.avgRating(address)

  // Average response time: time between submission and first creator status change
  function calcAvgResponseTime(): string | null {
    const creatorBounties = bounties.filter((b) => b.owner.toLowerCase() === address.toLowerCase())
    const pairs: number[] = []
    for (const bounty of creatorBounties) {
      const bSubs = allSubmissions.filter((s) => s.bountyId === bounty.id)
      for (const sub of bSubs) {
        if (sub.updatedAt > sub.submittedAt) {
          pairs.push(sub.updatedAt - sub.submittedAt)
        }
      }
    }
    if (pairs.length < 2) return null
    const avgSecs = pairs.reduce((a, b) => a + b, 0) / pairs.length
    const hours = Math.round(avgSecs / 3600)
    if (hours < 24) return `${hours}h avg`
    return `${Math.round(hours / 24)}d avg`
  }

  const avgResponseTime = calcAvgResponseTime()

  const TABS: { id: ProfileTab; label: string; count?: number }[] = [
    { id: 'work', label: 'Completed Work', count: paidSubmissions.length },
    { id: 'created', label: 'Bounties Created', count: createdBounties.length },
    { id: 'reviews', label: 'Reviews', count: receivedReviews.length },
    { id: 'activity', label: 'Active', count: activeSubmissions.length },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Profile header card */}
      <div
        className="rounded-2xl p-6 border mb-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <UserAvatar
              address={address}
              avatarUrl={profile?.avatarUrl}
              displayName={profile?.displayName}
              size={72}
            />
            <div className="min-w-0">
              <h1 className="display font-700 text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                {profile?.displayName ?? formatAddress(address)}
              </h1>
              {profile?.username && (
                <p className="text-sm font-500 mb-0.5" style={{ color: 'var(--accent)' }}>
                  @{profile.username}
                </p>
              )}
              <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                {formatAddress(address)}
              </p>
              {profile?.joinedAt && (
                <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
                  Joined {formatDate(profile.joinedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isOwner && (
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-500 transition-colors"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Edit3 size={13} /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="text-sm leading-relaxed mt-4 max-w-xl" style={{ color: 'var(--muted)' }}>
            {profile.bio}
          </p>
        )}

        {/* Skills */}
        {profile?.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 rounded-full text-xs font-500 border"
                style={{ background: 'var(--accent-soft)', borderColor: 'var(--border)', color: 'var(--accent)' }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Links */}
        {(profile?.website || profile?.twitterHandle || profile?.githubHandle) && (
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <Globe size={13} /> {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {profile.twitterHandle && (
              <a
                href={`https://twitter.com/${profile.twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <Twitter size={13} /> @{profile.twitterHandle}
              </a>
            )}
            {profile.githubHandle && (
              <a
                href={`https://github.com/${profile.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <Github size={13} /> {profile.githubHandle}
              </a>
            )}
          </div>
        )}

        {/* Rating summary */}
        <div className="mt-4">
          <RatingSummary avg={avgRating} count={receivedReviews.length} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Completed"
          value={paidSubmissions.length > 0 ? String(paidSubmissions.length) : '—'}
          sub="bounties won"
        />
        <StatCard
          icon={<Award size={16} />}
          label="Earned"
          value={totalEarned > 0n ? formatUsdcRaw(totalEarned) : '—'}
          sub="total USDC"
        />
        <StatCard
          icon={<Briefcase size={16} />}
          label="Created"
          value={createdBounties.length > 0 ? String(createdBounties.length) : '—'}
          sub={`${completedCreated.length} completed`}
        />
        <StatCard
          icon={<BarChart2 size={16} />}
          label="Success Rate"
          value={completionRate !== null ? `${completionRate}%` : '—'}
          sub={completionRate !== null ? 'submissions' : 'not enough data'}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-500 whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
              marginBottom: '-1px',
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: tab === t.id ? 'var(--accent-soft)' : 'var(--surface-muted)', color: tab === t.id ? 'var(--accent)' : 'var(--subtle)' }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'work' && (
        <div className="space-y-3">
          {paidSubmissions.length === 0 ? (
            <EmptyState message="No completed work yet." />
          ) : (
            paidSubmissions.map((sub) => {
              const bounty = bounties.find((b) => b.id === sub.bountyId)
              return (
                <div
                  key={sub.id}
                  className="rounded-xl p-4 border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-600 text-sm" style={{ color: 'var(--ink)' }}>{sub.title}</p>
                      {bounty && (
                        <button
                          onClick={() => onSelectBounty(bounty.id)}
                          className="text-xs mt-0.5 flex items-center gap-1 transition-colors"
                          style={{ color: 'var(--accent)' }}
                        >
                          <ExternalLink size={11} /> {bounty.title}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bounty && (
                        <span className="text-sm font-700 tabular-nums" style={{ color: 'var(--ink)' }}>
                          {formatUsdcAmount(bounty.rewardRaw, 5042002)}
                        </span>
                      )}
                      <BountyStatusBadge status="completed" />
                    </div>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
                    {formatDate(sub.submittedAt)}
                  </p>
                  {sub.txHash && (
                    <a
                      href={`https://explorer.testnet.arc.io/tx/${sub.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs mt-1 transition-colors"
                      style={{ color: 'var(--muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                    >
                      <ExternalLink size={11} /> View payout tx
                    </a>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'created' && (
        <div className="space-y-3">
          {createdBounties.length === 0 ? (
            <EmptyState message="No bounties created yet." />
          ) : (
            createdBounties.map((bounty) => (
              <button
                key={bounty.id}
                onClick={() => onSelectBounty(bounty.id)}
                className="w-full text-left rounded-xl p-4 border transition-all"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-600 text-sm" style={{ color: 'var(--ink)' }}>{bounty.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{formatDate(bounty.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-700 tabular-nums" style={{ color: 'var(--ink)' }}>
                      {formatUsdcAmount(bounty.rewardRaw, 5042002)}
                    </span>
                    <BountyStatusBadge status={bounty.status} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-3">
          {receivedReviews.length === 0 ? (
            <EmptyState message="No reviews yet. Reviews appear after a bounty is completed." />
          ) : (
            receivedReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl p-4 border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar address={review.reviewerAddress} size={28} />
                    <div>
                      <p className="text-xs font-600" style={{ color: 'var(--ink)' }}>
                        {formatAddress(review.reviewerAddress)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                        {review.direction === 'creator_to_contributor' ? 'Bounty creator' : 'Contributor'} · {formatDate(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <StarRating value={review.rating} size={14} readOnly />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {review.text}
                </p>
                <div
                  className="flex items-center gap-1 mt-2 text-xs"
                  style={{ color: 'var(--subtle)' }}
                >
                  <CheckCircle2 size={11} style={{ color: 'var(--success)' }} />
                  Verified completed-bounty interaction
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-3">
          {activeSubmissions.length === 0 ? (
            <EmptyState message="No active submissions." />
          ) : (
            activeSubmissions.map((sub) => {
              const bounty = bounties.find((b) => b.id === sub.bountyId)
              return (
                <div
                  key={sub.id}
                  className="rounded-xl p-4 border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <p className="font-600 text-sm" style={{ color: 'var(--ink)' }}>{sub.title}</p>
                  {bounty && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      for "{bounty.title}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-500 border"
                      style={{
                        background: sub.status === 'under_review' ? 'rgba(37,99,235,0.08)' : 'var(--surface-muted)',
                        borderColor: 'var(--border)',
                        color: sub.status === 'under_review' ? '#2563eb' : 'var(--muted)',
                      }}
                    >
                      {sub.status === 'under_review' ? 'Under review' : 'Pending review'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                      <Clock size={11} className="inline mr-1" />
                      {formatDate(sub.submittedAt)}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Creator response time (only show for creators with data) */}
      {avgResponseTime && (
        <div
          className="mt-6 p-4 rounded-xl border flex items-center gap-3"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <Clock size={16} style={{ color: 'var(--muted)' }} />
          <div>
            <p className="text-sm font-600" style={{ color: 'var(--ink)' }}>Avg review response: {avgResponseTime}</p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Time from submission to first status change</p>
          </div>
        </div>
      )}

      {/* Total funded (for creators) */}
      {totalFunded > 0n && (
        <div
          className="mt-3 p-4 rounded-xl border flex items-center gap-3"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <Star size={16} style={{ color: '#f59e0b' }} />
          <div>
            <p className="text-sm font-600" style={{ color: 'var(--ink)' }}>
              {formatUsdcRaw(totalFunded)} funded in bounties
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Total USDC deposited into escrow</p>
          </div>
        </div>
      )}

      {showEdit && <EditProfileModal address={address} onClose={() => setShowEdit(false)} />}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--accent)' }}>
        {icon}
        <span className="text-xs font-600 uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <p className="display font-700 text-xl tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{sub}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-8 border text-center"
      style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm" style={{ color: 'var(--subtle)' }}>{message}</p>
    </div>
  )
}
