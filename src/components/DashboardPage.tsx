import { useAccount } from '@/hooks/useAccount'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import { Plus, ExternalLink, Clock, MessageSquare, FileText } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdcAmount, formatDate, formatAddress } from '@/lib/utils'
import { BountyStatusBadge, SubmissionStatusBadge } from './StatusBadge'
import { ReceiptsSection } from './ReceiptCard'
import { useReceipts } from '@/hooks/useReceipts'
import { ARC_TESTNET_CHAIN_ID, isArcChain } from '@/contracts/VeritasEscrow'
import type { Bounty, Submission } from '@/types/bounty'
import type { UserRole } from '@/hooks/useRole'

interface DashboardPageProps {
  bounties: Bounty[]
  submissions: Submission[]
  onNavigate: (view: string) => void
  onSelectBounty: (id: string) => void
  onViewReceipt: (receiptId: string) => void
  onProfileClick?: (address: string) => void
  role?: UserRole | null
}

export function DashboardPage({
  bounties,
  submissions,
  onNavigate,
  onSelectBounty,
  onViewReceipt,
  role,
}: DashboardPageProps) {
  const isCreator = role === 'creator'
  const { address, isConnected, chainId } = useAccount()
  const displayChainId = chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID
  const receiptsApi = useReceipts()

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1
          className="display font-700 text-2xl mb-3"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          Your Dashboard
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Connect your wallet to view your bounties and submissions.
        </p>
        <PrivyLoginButton variant="light" />
      </div>
    )
  }

  const myBounties = bounties.filter(
    (b) => b.owner.toLowerCase() === address?.toLowerCase(),
  )
  const mySubmissions = submissions.filter(
    (s) => s.contributor.toLowerCase() === address?.toLowerCase(),
  )
  const myReceipts = address ? receiptsApi.forContributor(address) : []

  const totalLocked = myBounties
    .filter((b) => b.status === 'open' || b.status === 'in_review')
    .reduce((sum, b) => sum + b.rewardRaw, 0n)

  const totalPaid = myBounties
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + b.rewardRaw, 0n)

  // Freelancer: sum reward of bounties where this address was the approved contributor + paid
  const totalEarned = mySubmissions
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => {
      const b = bounties.find((bx) => bx.id === s.bountyId)
      return sum + (b ? b.rewardRaw : 0n)
    }, 0n)

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="display font-700 text-2xl"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            {isCreator ? 'Creator Dashboard' : 'My Work'}
          </h1>
          <p className="mono text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            {formatAddress(address ?? '')}
          </p>
        </div>
        {isCreator && (
          <button
            onClick={() => onNavigate('create')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 min-h-[44px]"
            style={{ background: 'var(--cta)', color: '#ffffff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cta-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cta)')}
          >
            <Plus size={15} />
            Post Bounty
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {(isCreator
          ? [
              { label: 'Bounties Posted', value: myBounties.length.toString() },
              {
                label: 'Active Bounties',
                value: myBounties
                  .filter((b) => b.status === 'open' || b.status === 'in_review')
                  .length.toString(),
              },
              {
                label: 'USDC In Escrow',
                value: formatUsdcAmount(totalLocked, displayChainId),
                mono: true,
              },
              {
                label: 'Total Paid Out',
                value: formatUsdcAmount(totalPaid, displayChainId),
                mono: true,
              },
            ]
          : [
              { label: 'Submissions Made', value: mySubmissions.length.toString() },
              {
                label: 'Approved',
                value: mySubmissions.filter((s) => s.status === 'approved' || s.status === 'paid').length.toString(),
              },
              {
                label: 'USDC Earned',
                value: formatUsdcAmount(totalEarned, displayChainId),
                mono: true,
              },
              { label: 'Receipts', value: myReceipts.length.toString() },
            ]
        ).map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-4 border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p
              className="text-xs font-600 mb-1"
              style={{ color: 'var(--subtle)', letterSpacing: '0.04em' }}
            >
              {stat.label}
            </p>
            <p
              className={`font-700 text-xl ${stat.mono ? 'display tabular-nums' : 'display'}`}
              style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Bounties */}
        <section>
          <h2
            className="display font-600 text-base mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            My Bounties
          </h2>

          {myBounties.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-2xl border text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                No bounties posted yet.
              </p>
              <button
                onClick={() => onNavigate('create')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-600 min-h-[36px]"
                style={{ background: 'var(--accent)', color: '#ffffff' }}
              >
                <Plus size={13} />
                Post your first bounty
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myBounties.map((b) => {
                const subCount = submissions.filter((s) => s.bountyId === b.id).length
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelectBounty(b.id)}
                    className="w-full text-left rounded-2xl p-4 border transition-colors"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget).style.background = 'var(--surface-strong)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget).style.background = 'var(--surface)')
                    }
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p
                        className="display font-600 text-sm truncate"
                        style={{ color: 'var(--ink)' }}
                      >
                        {b.title}
                      </p>
                      <BountyStatusBadge status={b.status} />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <TokenUSDC variant="branded" size={14} />
                        <span
                          className="display font-700 text-sm tabular-nums"
                          style={{ color: 'var(--accent)' }}
                        >
                          {formatUsdcAmount(b.rewardRaw, displayChainId)}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--subtle)' }}
                      >
                        <Clock size={11} />
                        {formatDate(b.deadline)}
                      </div>
                      {subCount > 0 && (
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--subtle)' }}>
                          <MessageSquare size={11} />
                          {subCount} {subCount === 1 ? 'submission' : 'submissions'}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* My Submissions */}
        <section>
          <h2
            className="display font-600 text-base mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            My Submissions
          </h2>

          {mySubmissions.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-2xl border text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                No submissions yet. Browse open bounties and submit your work.
              </p>
              <button
                onClick={() => onNavigate('marketplace')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-600 min-h-[36px]"
                style={{
                  border: '1px solid var(--border-strong)',
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                }}
              >
                Browse open bounties
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {mySubmissions.map((s) => {
                const bounty = bounties.find((b) => b.id === s.bountyId)
                return (
                  <button
                    key={s.id}
                    onClick={() => bounty && onSelectBounty(bounty.id)}
                    className="w-full text-left rounded-2xl p-4 border transition-colors"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget).style.background = 'var(--surface-strong)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget).style.background = 'var(--surface)')
                    }
                  >
                    {/* Bounty title + status */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p
                        className="display font-600 text-sm truncate"
                        style={{ color: 'var(--ink)' }}
                      >
                        {s.title}
                      </p>
                      <SubmissionStatusBadge status={s.status} />
                    </div>

                    {/* Bounty name */}
                    {bounty && (
                      <p className="text-xs mb-2 truncate" style={{ color: 'var(--subtle)' }}>
                        For: {bounty.title}
                      </p>
                    )}

                    {/* Summary preview */}
                    <p
                      className="text-xs line-clamp-2 mb-2"
                      style={{ color: 'var(--muted)' }}
                    >
                      {s.summary}
                    </p>

                    {/* Deliverable links */}
                    {s.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {s.deliverables.slice(0, 3).map((d, i) => (
                          <span
                            key={i}
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border"
                            style={{ borderColor: 'var(--border)', color: 'var(--accent)', background: 'rgba(172,198,233,0.06)' }}
                            onClick={(e) => { e.stopPropagation(); window.open(d.url, '_blank', 'noopener,noreferrer') }}
                          >
                            <ExternalLink size={10} />
                            {d.label || 'Link'}
                          </span>
                        ))}
                        {s.deliverables.length > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}>
                            +{s.deliverables.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Creator note */}
                    {s.creatorNote && (
                      <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <MessageSquare size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--subtle)' }} />
                        <p className="text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>
                          <span className="font-600" style={{ color: 'var(--subtle)' }}>Creator: </span>
                          {s.creatorNote}
                        </p>
                      </div>
                    )}

                    {/* Footer row */}
                    <div className="flex items-center gap-3 mt-2">
                      {s.txHash && (
                        <a
                          href={`https://explorer.testnet.arc.io/tx/${s.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs"
                          style={{ color: 'var(--accent)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={11} />
                          View payout
                        </a>
                      )}
                      {bounty && (
                        <div className="flex items-center gap-1.5">
                          <TokenUSDC variant="branded" size={12} />
                          <span className="text-xs display font-700 tabular-nums" style={{ color: 'var(--accent)' }}>
                            {formatUsdcAmount(bounty.rewardRaw, displayChainId)}
                          </span>
                        </div>
                      )}
                      <span className="text-xs ml-auto" style={{ color: 'var(--subtle)' }}>
                        {formatDate(s.submittedAt)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* My Receipts */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} style={{ color: 'var(--accent)' }} />
          <h2
            className="display font-600 text-base"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            My Receipts
          </h2>
          {myReceipts.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-600"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {myReceipts.length}
            </span>
          )}
        </div>
        <ReceiptsSection
          receipts={myReceipts}
          onViewReceipt={onViewReceipt}
          onNavigate={onNavigate}
        />
      </section>
    </div>
  )
}
