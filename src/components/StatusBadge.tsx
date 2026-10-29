import { cn } from '@/lib/utils'
import type { BountyStatus, SubmissionStatus } from '@/types/bounty'

const BOUNTY_CONFIG: Record<BountyStatus, { label: string; cls: string }> = {
  draft: {
    label: 'Awaiting Funding',
    cls: 'bg-slate-100 text-slate-500 border-slate-200',
  },
  open: {
    label: 'Open',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  in_review: {
    label: 'In Review',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'bg-red-50 text-red-600 border-red-200',
  },
  expired: {
    label: 'Expired',
    cls: 'bg-slate-100 text-slate-500 border-slate-200',
  },
}

const SUBMISSION_CONFIG: Record<SubmissionStatus, { label: string; cls: string }> = {
  pending: {
    label: 'Pending',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  under_review: {
    label: 'Under Review',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  revision_requested: {
    label: 'Revision Requested',
    cls: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  approved: {
    label: 'Approved',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  paid: {
    label: 'Paid',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  rejected: {
    label: 'Rejected',
    cls: 'bg-red-50 text-red-600 border-red-200',
  },
}

interface BountyStatusBadgeProps {
  status: BountyStatus
}

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus
}

export function BountyStatusBadge({ status }: BountyStatusBadgeProps) {
  const { label, cls } = BOUNTY_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border',
        cls,
      )}
      style={{ letterSpacing: '0.04em' }}
    >
      {label}
    </span>
  )
}

export function SubmissionStatusBadge({ status }: SubmissionStatusBadgeProps) {
  const { label, cls } = SUBMISSION_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 border',
        cls,
      )}
      style={{ letterSpacing: '0.04em' }}
    >
      {label}
    </span>
  )
}
