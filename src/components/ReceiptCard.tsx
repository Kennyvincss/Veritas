/**
 * ReceiptCard — compact card showing a single Work Receipt.
 * Used in the dashboard's "My Receipts" section.
 *
 * Shows: bounty title, completion date, reward, verification status,
 * and a "View Receipt" button that navigates to the public verify page.
 *
 * Private submission content is never exposed here.
 */

import { CheckCircle2, XCircle, Clock, FileText, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatDate, formatUsdcAmount } from '@/lib/utils'
import type { WorkReceipt, ReceiptVerificationStatus } from '@/types/bounty'

const ARC_TESTNET_ID = 5042002

interface StatusBadgeProps {
  status: ReceiptVerificationStatus
}

function ReceiptStatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'hash_verified':
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600"
          style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
        >
          <CheckCircle2 size={11} /> Verified
        </span>
      )
    case 'hash_mismatch':
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600"
          style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
        >
          <XCircle size={11} /> Verification Failed
        </span>
      )
    default:
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600"
          style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <Clock size={11} /> Pending
        </span>
      )
  }
}

interface ReceiptCardProps {
  receipt: WorkReceipt
  onViewReceipt: (receiptId: string) => void
}

export function ReceiptCard({ receipt, onViewReceipt }: ReceiptCardProps) {
  const rewardRaw = BigInt(receipt.rewardRawString)

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-soft)' }}
          >
            <FileText size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <p
              className="display font-600 text-sm truncate"
              style={{ color: 'var(--ink)' }}
            >
              {receipt.bountyTitle}
            </p>
            <p className="text-xs mono" style={{ color: 'var(--subtle)' }}>
              Bounty #{receipt.bountyId}
            </p>
          </div>
        </div>
        <ReceiptStatusBadge status={receipt.verificationStatus} />
      </div>

      {/* Reward + date row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <TokenUSDC variant="branded" size={14} />
          <span
            className="display font-700 text-sm tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {formatUsdcAmount(rewardRaw, ARC_TESTNET_ID)}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          Completed {formatDate(receipt.completedAt)}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => onViewReceipt(receipt.receiptId)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 flex-1 justify-center"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        >
          <ExternalLink size={12} />
          View Receipt
        </button>
        <p className="text-xs mono" style={{ color: 'var(--subtle)' }}>
          #{receipt.receiptId.slice(-8)}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReceiptsSection — used inside DashboardPage
// ---------------------------------------------------------------------------

interface ReceiptsSectionProps {
  receipts: WorkReceipt[]
  onViewReceipt: (receiptId: string) => void
  onNavigate: (view: string) => void
}

export function ReceiptsSection({ receipts, onViewReceipt, onNavigate }: ReceiptsSectionProps) {
  if (receipts.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-10 rounded-2xl border text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: 'var(--accent-soft)' }}
        >
          <FileText size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <p className="font-600 text-sm mb-1" style={{ color: 'var(--ink)' }}>No receipts yet</p>
        <p className="text-xs mb-4 max-w-xs" style={{ color: 'var(--muted)' }}>
          Receipts are issued automatically when a bounty payment is confirmed onchain.
          Complete a bounty to earn your first proof-of-work receipt.
        </p>
        <button
          onClick={() => onNavigate('marketplace')}
          className="px-4 py-2 rounded-xl text-xs font-600"
          style={{ border: '1px solid var(--border-strong)', color: 'var(--ink)' }}
        >
          Browse open bounties
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {receipts.map((r) => (
        <ReceiptCard key={r.receiptId} receipt={r} onViewReceipt={onViewReceipt} />
      ))}
    </div>
  )
}
