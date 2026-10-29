/**
 * BountyCard — Jobsync-inspired compact card.
 *
 * Layout:
 *   [Avatar/logo mark]  [Title + creator]     [bookmark icon]
 *   [Status chips row]
 *   [Reward amount]     [deadline chip]        [Details →]
 */
import { Clock, Bookmark, CheckCircle2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatAddress, formatUsdcAmount, timeRemaining } from '@/lib/utils'
import { BountyStatusBadge } from './StatusBadge'
import { UserAvatar } from './UserAvatar'
import { useProfiles } from '@/hooks/useProfiles'
import { useAccount } from '@/hooks/useAccount'
import { ARC_TESTNET_CHAIN_ID, isArcChain } from '@/contracts/VeritasEscrow'
import type { Bounty } from '@/types/bounty'

interface BountyCardProps {
  bounty: Bounty
  onClick: (id: string) => void
  onProfileClick?: (address: string) => void
  /** True when the connected user already has a submission for this bounty. */
  hasMySubmission?: boolean
  /** When true the card renders in a selected/active state (detail panel open). */
  selected?: boolean
}

export function BountyCard({
  bounty,
  onClick,
  onProfileClick,
  hasMySubmission = false,
  selected = false,
}: BountyCardProps) {
  const remaining = timeRemaining(bounty.deadline)
  const isExpired = remaining === 'Expired'
  const { getProfile } = useProfiles()
  const ownerProfile = getProfile(bounty.owner)
  const { chainId } = useAccount()
  const displayChainId = chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID

  return (
    <button
      onClick={() => onClick(bounty.id)}
      className="w-full text-left rounded-2xl p-4 border transition-all duration-150 group"
      style={{
        background: 'var(--surface)',
        borderColor: selected
          ? '#16a34a'
          : hasMySubmission
          ? 'rgba(22,163,74,0.30)'
          : 'var(--border)',
        boxShadow: selected
          ? '0 0 0 2px rgba(22,163,74,0.15), var(--shadow-card)'
          : 'var(--shadow-card)',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(17,24,39,0.10), 0 1px 3px rgba(17,24,39,0.06)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = hasMySubmission ? 'rgba(22,163,74,0.30)' : 'var(--border)'
          e.currentTarget.style.boxShadow = 'var(--shadow-card)'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      {/* Row 1: Avatar + title + bookmark */}
      <div className="flex items-start gap-3 mb-3">
        {/* Creator avatar / logo mark */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onProfileClick?.(bounty.owner) }}
          className="shrink-0 mt-0.5"
          style={{ background: 'none', border: 'none', padding: 0 }}
          title="View creator profile"
        >
          <UserAvatar
            address={bounty.owner}
            avatarUrl={ownerProfile?.avatarUrl}
            displayName={ownerProfile?.displayName}
            size={38}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className="display font-600 text-sm leading-snug truncate"
                style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
              >
                {bounty.title}
              </h3>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onProfileClick?.(bounty.owner) }}
                className="text-xs mt-0.5 truncate max-w-full transition-colors hover:underline block"
                style={{
                  color: '#16a34a',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                {ownerProfile?.displayName ?? formatAddress(bounty.owner)}
                {ownerProfile?.username && (
                  <span style={{ color: 'var(--subtle)' }}> · @{ownerProfile.username}</span>
                )}
              </button>
            </div>

            {/* Bookmark / submitted indicator */}
            <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
              {hasMySubmission ? (
                <span
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-600"
                  style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
                >
                  <CheckCircle2 size={10} />
                  Applied
                </span>
              ) : (
                <span
                  className="w-7 h-7 flex items-center justify-center rounded-lg border transition-colors"
                  style={{
                    background: selected ? 'var(--ink)' : 'var(--surface-muted)',
                    borderColor: 'var(--border)',
                    color: selected ? '#fff' : 'var(--subtle)',
                  }}
                >
                  <Bookmark size={13} fill={selected ? 'currentColor' : 'none'} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Status chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <BountyStatusBadge status={bounty.status} />
        {isExpired && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-600 border"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'transparent' }}
          >
            Expired
          </span>
        )}
      </div>

      {/* Row 3: Reward + deadline + CTA */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TokenUSDC variant="branded" size={16} />
          <span
            className="display font-700 text-base tabular-nums"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            {formatUsdcAmount(bounty.rewardRaw, displayChainId)}
          </span>
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>/bounty</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Clock size={11} style={{ color: isExpired ? 'var(--danger)' : 'var(--subtle)' }} />
            <span
              className="text-xs"
              style={{ color: isExpired ? 'var(--danger)' : 'var(--subtle)' }}
            >
              {remaining}
            </span>
          </div>

          <span
            className="px-3 py-1.5 rounded-xl text-xs font-600 transition-colors"
            style={{
              background: selected ? 'var(--ink)' : 'rgba(22,163,74,0.12)',
              color: selected ? '#fff' : '#16a34a',
            }}
          >
            {selected ? 'Viewing' : 'Details'}
          </span>
        </div>
      </div>
    </button>
  )
}
