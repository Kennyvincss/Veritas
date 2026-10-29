/**
 * BountyDetailPage — Stage 5
 *
 * Stage 5 additions over Stage 4:
 *   - Approve button in owner review panel; triggers 2-step onchain flow:
 *       approveContributor() → releasePayment()
 *   - Confirmation dialog before approval: shows bounty, contributor, reward, action.
 *   - Per-step progress: Approving → Confirming → Releasing → Confirmed with tx links.
 *   - Submission updated to 'approved' after step 1, 'paid' after step 2.
 *   - Cancel Bounty button for owner on eligible (Funded/Approved) bounties.
 *   - Sonner toasts for secondary notifications.
 *   - Duplicate-payout guard: Approve button hidden once a submission is approved/paid
 *     or once a different submission has been approved for this bounty.
 *
 * Contract authorization is enforced by the contract — frontend gates are UX only.
 */

import { useState } from 'react'
import { useAccount } from '@/hooks/useAccount'
import { PrivyLoginButton } from '@/components/PrivyLoginButton'
import { toast } from 'sonner'
import {
  ArrowLeft, ExternalLink, Clock, User, Shield, Plus, Trash2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, MessageSquare,
  Loader2, DollarSign, XCircle, Ban,
} from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import {
  formatAddress,
  formatUsdcAmount,
  formatDate,
  timeRemaining,
  formatTxHash,
} from '@/lib/utils'
import { BountyStatusBadge, SubmissionStatusBadge } from './StatusBadge'
import type { Bounty, Submission, SubmissionStatus, DeliverableLink } from '@/types/bounty'
import { ARC_TESTNET_CHAIN_ID, ESCROW_ADDRESS, getEscrowAddress, getExplorerBase, isArcChain } from '@/contracts/VeritasEscrow'
import type { UseSubmissionsResult } from '@/hooks/useSubmissions'
import { useApproveAndPay, useReleasePayment } from '@/hooks/useApproveAndPay'
import { useCancelBounty } from '@/hooks/useCancelBounty'
import { useReceipts } from '@/hooks/useReceipts'
import { AIEvaluationPanel } from './AIEvaluationPanel'

const MAX_TITLE_LEN = 150
const MAX_SUMMARY_LEN = 4_000
const MAX_URL_LEN = 512
const MAX_DELIVERABLES = 8

const emptyLink = (): DeliverableLink => ({ label: '', url: '' })

// Offchain-only status actions (no wallet tx required)
const OFFCHAIN_STATUS_ACTIONS: { status: SubmissionStatus; label: string; color: string }[] = [
  { status: 'under_review', label: 'Mark Under Review', color: 'var(--accent)' },
  { status: 'revision_requested', label: 'Request Revision', color: '#f59e0b' },
  { status: 'rejected', label: 'Reject', color: 'var(--danger)' },
]

interface BountyDetailPageProps {
  bounty: Bounty
  submissions: Submission[]
  submissionsApi: UseSubmissionsResult
  onBack: () => void
  onRefresh?: () => void
  onProfileClick?: (address: string) => void
}

// ── Step progress copy ────────────────────────────────────────────────────────

function stepLabel(step: string): string {
  switch (step) {
    case 'approving': return 'Sign the approval transaction in your wallet…'
    case 'approve_pending': return 'Confirming approval onchain…'
    case 'releasing': return 'Sign the payment release transaction in your wallet…'
    case 'release_pending': return 'Confirming payment onchain…'
    case 'success': return 'Payment confirmed. USDC has been sent to the contributor.'
    default: return ''
  }
}

export function BountyDetailPage({
  bounty,
  submissions,
  submissionsApi,
  onBack,
  onRefresh,
  onProfileClick,
}: BountyDetailPageProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount()

  // ── submission form state ─────────────────────────────────────────────────
  const [formTitle, setFormTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [deliverables, setDeliverables] = useState<DeliverableLink[]>([emptyLink()])
  const [titleError, setTitleError] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [urlErrors, setUrlErrors] = useState<string[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successId, setSuccessId] = useState<string | null>(null)

  // ── creator review state ──────────────────────────────────────────────────
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({})

  // ── approval confirm dialog state ─────────────────────────────────────────
  const [pendingApproval, setPendingApproval] = useState<Submission | null>(null)

  // ── cancel confirm dialog state ───────────────────────────────────────────
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // ── onchain hooks ─────────────────────────────────────────────────────────
  const approveAndPay = useApproveAndPay()
  const releasePayment = useReleasePayment()   // resume path: bounty already Approved
  const cancelBounty = useCancelBounty()
  const receiptsApi = useReceipts()

  const isOwner = !!address && address.toLowerCase() === bounty.owner.toLowerCase()

  // Stage 2: determine chain context for receipt issuance
  // Use the connected wallet's chainId if it's an Arc chain; fall back to Arc Testnet
  const receiptChainId = (walletChainId !== undefined && isArcChain(walletChainId))
    ? walletChainId
    : ARC_TESTNET_CHAIN_ID
  const receiptEscrowAddress = getEscrowAddress(receiptChainId) ?? ESCROW_ADDRESS
  // Derive explorer base from the connected chain so tx links point to the correct network
  const explorer = getExplorerBase(receiptChainId)
  const [nowSec] = useState<number>(() => Math.floor(Date.now() / 1000))
  const isExpired = bounty.deadline < nowSec
  // 'draft' = Created onchain, not yet funded — no USDC in escrow, must not accept submissions
  const isDraft = bounty.status === 'draft'
  const isLive = (bounty.status === 'open' || bounty.status === 'in_review') && !isExpired
  const alreadySubmitted = !!(address && submissionsApi.hasSubmitted(bounty.id, address))
  const canSubmit = isConnected && !isOwner && isLive && !alreadySubmitted && !isDraft

  // True once any submission for this bounty is approved or paid
  const hasApprovedOrPaid = submissions.some(
    (s) => s.status === 'approved' || s.status === 'paid',
  )

  /**
   * Resume payment path: the bounty is Approved onchain (approveContributor already confirmed)
   * but either the releasePayment tx was never sent or the tab was closed between the two steps.
   * Show a "Resume — Release Payment" button driven entirely from onchain state.
   */
  const canResumePayment =
    isOwner &&
    bounty.status === 'in_review' &&
    !!bounty.approvedContributor &&
    !submissions.some((s) => s.status === 'paid') &&
    approveAndPay.state.step === 'idle' &&
    releasePayment.state.step === 'idle'

  // Eligible for cancel: bounty is Funded or Approved onchain
  const canCancel =
    isOwner &&
    (bounty.status === 'open' || bounty.status === 'in_review') &&
    cancelBounty.state.step === 'idle'

  // My own submission (contributor view)
  const mySubmission = address
    ? submissions.find((s) => s.contributor.toLowerCase() === address.toLowerCase())
    : undefined

  // ── Deliverable helpers ───────────────────────────────────────────────────

  function updateDeliverable(idx: number, field: keyof DeliverableLink, value: string) {
    setDeliverables((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
    if (field === 'url') {
      setUrlErrors((prev) => { const next = [...prev]; next[idx] = ''; return next })
    }
  }

  function addDeliverable() {
    if (deliverables.length < MAX_DELIVERABLES) setDeliverables((prev) => [...prev, emptyLink()])
  }

  function removeDeliverable(idx: number) {
    setDeliverables((prev) => prev.filter((_, i) => i !== idx))
    setUrlErrors((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Form validation ───────────────────────────────────────────────────────

  function validateForm(): boolean {
    let valid = true
    if (!formTitle.trim()) { setTitleError('Submission title is required.'); valid = false }
    else setTitleError('')

    if (!summary.trim()) { setSummaryError('Work description is required.'); valid = false }
    else setSummaryError('')

    const newUrlErrors: string[] = deliverables.map((d) => {
      if (!d.url.trim()) return ''
      try { new URL(d.url); return '' } catch { return 'Enter a valid URL (include https://).' }
    })
    setUrlErrors(newUrlErrors)
    if (newUrlErrors.some(Boolean)) valid = false
    return valid
  }

  function handleProceedToConfirm(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    if (validateForm()) setShowConfirm(true)
  }

  function handleConfirmSubmit() {
    if (!address) return
    setSubmitError('')
    const result = submissionsApi.submit({
      bountyId: bounty.id,
      bountyOwner: bounty.owner,
      contributor: address,
      title: formTitle.trim(),
      summary: summary.trim(),
      deliverables: deliverables.filter((d) => d.url.trim()),
    })
    if (result.ok) {
      setSuccessId(result.submission.id)
      setShowConfirm(false)
      setFormTitle('')
      setSummary('')
      setDeliverables([emptyLink()])
    } else {
      setSubmitError(result.error)
      setShowConfirm(false)
    }
  }

  // ── Offchain status update ────────────────────────────────────────────────

  function handleOffchainStatusChange(submissionId: string, newStatus: SubmissionStatus) {
    if (!address) return
    const note = noteInputs[submissionId] ?? ''
    const result = submissionsApi.updateStatus(submissionId, newStatus, address, bounty.owner, note || undefined)
    if (result.ok) {
      const msg = newStatus === 'rejected'
        ? 'Submission rejected.'
        : newStatus === 'revision_requested'
        ? 'Revision requested.'
        : 'Status updated.'
      setReviewFeedback((prev) => ({ ...prev, [submissionId]: msg }))
      setNoteInputs((prev) => ({ ...prev, [submissionId]: '' }))
      setTimeout(() => setReviewFeedback((prev) => ({ ...prev, [submissionId]: '' })), 4000)
    } else {
      setReviewFeedback((prev) => ({ ...prev, [submissionId]: result.error }))
    }
  }

  // ── Onchain approval flow ─────────────────────────────────────────────────

  function handleConfirmApproval() {
    if (!pendingApproval || !address) return
    const sub = pendingApproval
    setPendingApproval(null)

    approveAndPay.execute({
      bountyId: bounty.id,
      contributorAddress: sub.contributor,
      submissionId: sub.id,
      onApproved: () => {
        submissionsApi.markApproved(sub.id)
        toast.success('Contributor approved onchain. Releasing payment…')
      },
      onPaid: (txHash) => {
        submissionsApi.markPaid(sub.id, txHash)
        toast.success('Payment confirmed! USDC has been sent to the contributor.')
        onRefresh?.()
        // Create Proof-of-Work Receipt
        void receiptsApi.createReceipt({
          bountyId: bounty.id,
          bountyTitle: bounty.title,
          bountyDescriptionSnapshot: bounty.description,
          creatorAddress: bounty.owner,
          contributorAddress: sub.contributor,
          submissionId: sub.id,
          submissionTitle: sub.title,
          submissionSummary: sub.summary,
          rewardRawString: bounty.rewardRaw.toString(),
          completedAt: Math.floor(Date.now() / 1000),
          paymentTxHash: txHash,
          chainId: receiptChainId,
          escrowContractAddress: receiptEscrowAddress,
        }).then((result) => {
          if (result.ok) toast.success(`Receipt issued: ${result.receipt.receiptId.slice(-8)}`)
        })
      },
    })
  }

  // ── Onchain cancel flow ───────────────────────────────────────────────────

  function handleConfirmCancel() {
    setShowCancelConfirm(false)
    cancelBounty.execute(bounty.id, () => {
      toast.success('Bounty cancelled. USDC refunded to your wallet.')
      onRefresh?.()
    })
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  /**
   * Only render deliverable links whose scheme is https: or http:.
   * javascript:, data:, and other schemes are silently skipped to prevent XSS —
   * they should never reach storage, but this is a defence-in-depth render guard.
   */
  function renderDeliverables(dels: DeliverableLink[]) {
    const safe = dels.filter((d) => {
      if (!d.url.trim()) return false
      try {
        const p = new URL(d.url)
        return p.protocol === 'https:' || p.protocol === 'http:'
      } catch { return false }
    })
    if (!safe.length) return null
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {safe.map((d, i) => (
          <a
            key={i}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--accent)', background: 'var(--accent-soft)' }}
          >
            <ExternalLink size={11} />
            {d.label || d.url.replace(/^https?:\/\//, '').slice(0, 40)}
          </a>
        ))}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <ArrowLeft size={15} />
        Back to marketplace
      </button>

      {/* ── Bounty header card ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 border mb-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <a
            href={`${explorer}/address/${receiptEscrowAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--subtle)' }}
          >
            <Shield size={12} style={{ color: 'var(--success)' }} />
            Bounty #{bounty.id} · Arc Testnet
            <ExternalLink size={10} />
          </a>
          <BountyStatusBadge status={bounty.status} />
        </div>

        <h1
          className="display font-700 text-2xl leading-tight mb-4"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          {bounty.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mb-5">
          <button
            type="button"
            onClick={() => onProfileClick?.(bounty.owner)}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--subtle)', background: 'none', border: 'none', padding: 0, cursor: onProfileClick ? 'pointer' : 'default' }}
            onMouseEnter={(e) => { if (onProfileClick) e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--subtle)' }}
          >
            <User size={13} />
            <span className="mono">{formatAddress(bounty.owner)}</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: isExpired ? 'var(--danger)' : 'var(--subtle)' }}>
            <Clock size={13} />
            <span>{timeRemaining(bounty.deadline)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
            <span>Deadline {formatDate(bounty.deadline)}</span>
          </div>
        </div>

        <div
          className="flex items-center gap-2 p-4 rounded-xl mb-5"
          style={{ background: 'var(--accent-soft)' }}
        >
          <TokenUSDC variant="branded" size={24} />
          <span
            className="display font-700 text-3xl tabular-nums"
            style={{ color: 'var(--accent)', letterSpacing: '-0.03em' }}
          >
            {formatUsdcAmount(bounty.rewardRaw, receiptChainId)}
          </span>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>USDC reward</span>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
          {bounty.description}
        </p>

        {bounty.txHash && (
          <a
            href={`${explorer}/tx/${bounty.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs mt-4"
            style={{ color: 'var(--accent)' }}
          >
            <ExternalLink size={12} />
            Escrow funding tx: {formatTxHash(bounty.txHash)}
          </a>
        )}

        {/* Cancel button — owner only, eligible bounties */}
        {isOwner && canCancel && (
          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 border transition-colors min-h-[44px]"
              style={{ borderColor: 'rgba(192,54,77,0.28)', color: 'var(--danger)', background: 'var(--danger-bg)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,54,77,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--danger-bg)')}
            >
              <Ban size={14} />
              Cancel Bounty &amp; Refund
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
              Cancels the escrow and returns the full reward to your wallet. Only available while not yet paid.
            </p>
          </div>
        )}

        {/* Cancel progress / result */}
        {cancelBounty.state.step !== 'idle' && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {cancelBounty.isPending && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <Loader2 size={14} className="animate-spin shrink-0" />
                {cancelBounty.state.step === 'cancelling'
                  ? 'Sign the cancel transaction in your wallet…'
                  : 'Confirming cancellation onchain…'}
              </div>
            )}
            {cancelBounty.state.step === 'success' && cancelBounty.state.txHash && (
              <a
                href={`${explorer}/tx/${cancelBounty.state.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--success)' }}
              >
                <CheckCircle2 size={13} />
                Cancel confirmed · Refund tx: {formatTxHash(cancelBounty.state.txHash)}
                <ExternalLink size={11} />
              </a>
            )}
            {cancelBounty.state.step === 'error' && (
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{cancelBounty.state.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Approve-and-pay global progress banner ────────────────────────── */}
      {approveAndPay.state.step !== 'idle' && (
        <div
          className="rounded-2xl border p-5 mb-6"
          style={{
            background: approveAndPay.state.step === 'error'
              ? 'var(--danger-bg)'
              : approveAndPay.state.step === 'success'
              ? 'var(--success-bg)'
              : 'var(--accent-soft)',
            borderColor: approveAndPay.state.step === 'error'
              ? 'rgba(192,54,77,0.22)'
              : approveAndPay.state.step === 'success'
              ? 'rgba(26,122,69,0.25)'
              : 'var(--border)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {approveAndPay.isPending && <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />}
            {approveAndPay.state.step === 'success' && <CheckCircle2 size={15} className="shrink-0" style={{ color: 'var(--success)' }} />}
            {approveAndPay.state.step === 'error' && <AlertCircle size={15} className="shrink-0" style={{ color: 'var(--danger)' }} />}
            <p
              className="text-sm font-600"
              style={{
                color: approveAndPay.state.step === 'error'
                  ? 'var(--danger)'
                  : approveAndPay.state.step === 'success'
                  ? 'var(--success)'
                  : 'var(--ink)',
              }}
            >
              {approveAndPay.state.step === 'error'
                ? approveAndPay.state.error
                : stepLabel(approveAndPay.state.step)}
            </p>
          </div>

          {/* Step tracker */}
          <div className="flex items-center gap-2 mt-3">
            {(['approve_pending', 'releasing', 'release_pending', 'success'] as const).includes(
              approveAndPay.state.step as 'approve_pending' | 'releasing' | 'release_pending' | 'success'
            ) && approveAndPay.state.approveTxHash && (
              <a
                href={`${explorer}/tx/${approveAndPay.state.approveTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--accent)' }}
              >
                <ExternalLink size={11} />
                Approval tx: {formatTxHash(approveAndPay.state.approveTxHash)}
              </a>
            )}
            {approveAndPay.state.step === 'success' && approveAndPay.state.releaseTxHash && (
              <a
                href={`${explorer}/tx/${approveAndPay.state.releaseTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs ml-3"
                style={{ color: 'var(--success)' }}
              >
                <ExternalLink size={11} />
                Payout tx: {formatTxHash(approveAndPay.state.releaseTxHash)}
              </a>
            )}
          </div>

          {approveAndPay.state.step === 'error' && (
            <button
              onClick={approveAndPay.reset}
              className="mt-3 text-xs font-600"
              style={{ color: 'var(--accent)' }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* ── Resume payment banner (recovery path) ───────────────────────── */}
      {canResumePayment && (
        <div
          className="rounded-2xl border p-5 mb-6"
          style={{ background: 'var(--accent-soft)', borderColor: 'rgba(26,46,74,0.15)' }}
        >
          <p className="text-sm font-600 mb-1" style={{ color: 'var(--ink)' }}>
            Payment not yet released
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            This bounty is in Approved state onchain — a contributor was chosen but the payment
            release transaction was not completed. The approved contributor is{' '}
            <span className="mono">{bounty.approvedContributor}</span>.
          </p>
          <button
            onClick={() => {
              releasePayment.execute({
                bountyId: bounty.id,
                onPaid: (txHash) => {
                  // Find the matching submission and mark it paid if we can
                  const matched = submissions.find(
                    (s) => s.contributor.toLowerCase() === bounty.approvedContributor?.toLowerCase(),
                  )
                  if (matched) submissionsApi.markPaid(matched.id, txHash)
                  toast.success('Payment confirmed! USDC sent to contributor.')
                  onRefresh?.()
                  // Create Proof-of-Work Receipt (resume path)
                  if (matched && bounty.approvedContributor) {
                    void receiptsApi.createReceipt({
                      bountyId: bounty.id,
                      bountyTitle: bounty.title,
                      bountyDescriptionSnapshot: bounty.description,
                      creatorAddress: bounty.owner,
                      contributorAddress: bounty.approvedContributor,
                      submissionId: matched.id,
                      submissionTitle: matched.title,
                      submissionSummary: matched.summary,
                      rewardRawString: bounty.rewardRaw.toString(),
                      completedAt: Math.floor(Date.now() / 1000),
                      paymentTxHash: txHash,
                      chainId: receiptChainId,
                      escrowContractAddress: receiptEscrowAddress,
                    }).then((result) => {
                      if (result.ok) toast.success(`Receipt issued: ${result.receipt.receiptId.slice(-8)}`)
                    })
                  }
                },
              })
            }}
            disabled={releasePayment.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 border transition-colors min-h-[44px]"
            style={{
              background: 'rgba(141,216,159,0.1)',
              borderColor: 'rgba(26,122,69,0.3)',
              color: 'var(--success)',
              opacity: releasePayment.isPending ? 0.6 : 1,
            }}
          >
            {releasePayment.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Releasing…</>
              : <><DollarSign size={14} /> Resume — Release Payment</>}
          </button>
          {releasePayment.state.step === 'success' && releasePayment.state.txHash && (
            <a
              href={`${explorer}/tx/${releasePayment.state.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs mt-3"
              style={{ color: 'var(--success)' }}
            >
              <CheckCircle2 size={12} />
              Payout confirmed · tx: {formatTxHash(releasePayment.state.txHash)}
              <ExternalLink size={11} />
            </a>
          )}
          {releasePayment.state.step === 'error' && (
            <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>
              {releasePayment.state.error}
            </p>
          )}
        </div>
      )}

      {/* ── Submissions list ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2
          className="display font-600 text-base mb-4"
          style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          {isOwner ? `Submissions (${submissions.length})` : 'Submitted Work'}
        </h2>

        {submissions.length === 0 ? (
          <div
            className="py-10 text-center rounded-2xl border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {isOwner ? 'No submissions yet.' : 'No submissions have been made for this bounty yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {submissions
              .filter((s) => isOwner || (address && s.contributor.toLowerCase() === address.toLowerCase()))
              .map((s) => {
                const isExpanded = expandedSubmission === s.id
                const isThisApproved = s.status === 'approved' || s.status === 'paid'
                // Owner can approve only if: bounty eligible, no other approved, this sub not already approved
                const canApproveThis = isOwner && isLive && !hasApprovedOrPaid && !isThisApproved && !approveAndPay.isPending

                return (
                  <div
                    key={s.id}
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      background: 'var(--surface)',
                      borderColor: isThisApproved ? 'rgba(26,122,69,0.25)' : 'var(--border)',
                    }}
                  >
                    {/* Submission header */}
                    <button
                      className="w-full text-left px-5 py-4 flex items-start justify-between gap-2"
                      onClick={() => setExpandedSubmission(isExpanded ? null : s.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="display font-600 text-sm truncate" style={{ color: 'var(--ink)' }}>
                            {s.title}
                          </p>
                          <span
                            className="shrink-0 text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--subtle)' }}
                          >
                            offchain
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--subtle)' }}>
                          <span className="flex items-center gap-1">
                            <User size={11} />
                            <span className="mono">{formatAddress(s.contributor)}</span>
                          </span>
                          <span>{formatDate(s.submittedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SubmissionStatusBadge status={s.status} />
                        {isExpanded
                          ? <ChevronUp size={15} style={{ color: 'var(--subtle)' }} />
                          : <ChevronDown size={15} style={{ color: 'var(--subtle)' }} />}
                      </div>
                    </button>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
                        <p
                          className="text-sm leading-relaxed mt-4 mb-3"
                          style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}
                        >
                          {s.summary}
                        </p>

                        {renderDeliverables(s.deliverables)}

                        {/* Creator note */}
                        {s.creatorNote && (
                          <div
                            className="flex items-start gap-2 mt-4 p-3 rounded-xl border"
                            style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}
                          >
                            <MessageSquare size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--subtle)' }} />
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>
                              <span className="font-600" style={{ color: 'var(--subtle)' }}>Creator note: </span>
                              {s.creatorNote}
                            </p>
                          </div>
                        )}

                        {/* Payout tx link */}
                        {s.txHash && (
                          <a
                            href={`${explorer}/tx/${s.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs mt-3"
                            style={{ color: 'var(--success)' }}
                          >
                            <CheckCircle2 size={12} />
                            Payout confirmed · tx: {formatTxHash(s.txHash)}
                            <ExternalLink size={11} />
                          </a>
                        )}

                        {/* AI Evaluator — owner only, advisory, no payment triggers */}
                        {isOwner && s.status !== 'paid' && (
                          <div className="mt-5">
                            <AIEvaluationPanel
                              bounty={bounty}
                              submission={s}
                              ownerAddress={address ?? ''}
                            />
                          </div>
                        )}

                        {/* Owner review actions */}
                        {isOwner && s.status !== 'paid' && (
                          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xs font-600 mb-3" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                              CREATOR ACTIONS
                            </p>

                            {/* Approve & Pay — onchain */}
                            {canApproveThis && (
                              <button
                                onClick={() => setPendingApproval(s)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-600 border mb-3 transition-colors min-h-[44px]"
                                style={{
                                  background: 'var(--success-bg)',
                                  borderColor: 'rgba(26,122,69,0.3)',
                                  color: 'var(--success)',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(26,122,69,0.12)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--success-bg)')}
                              >
                                <DollarSign size={15} />
                                Approve &amp; Release Payment
                              </button>
                            )}

                            {/* Already approved / in progress */}
                            {s.status === 'approved' && approveAndPay.isPending && (
                              <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--muted)' }}>
                                <Loader2 size={14} className="animate-spin shrink-0" />
                                Releasing payment…
                              </div>
                            )}

                            {/* Offchain-only actions */}
                            {s.status !== 'approved' && (
                              <>
                                <textarea
                                  rows={2}
                                  placeholder="Optional note to contributor…"
                                  value={noteInputs[s.id] ?? ''}
                                  onChange={(e) =>
                                    setNoteInputs((prev) => ({ ...prev, [s.id]: e.target.value.slice(0, 500) }))
                                  }
                                  className="w-full rounded-xl px-3 py-2.5 text-xs border outline-none resize-none mb-3"
                                  style={{
                                    background: 'var(--surface-muted)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--ink)',
                                  }}
                                />
                                <div className="flex flex-wrap gap-2">
                                  {OFFCHAIN_STATUS_ACTIONS.map((action) => (
                                    <button
                                      key={action.status}
                                      onClick={() => handleOffchainStatusChange(s.id, action.status)}
                                      className="px-3 py-2 rounded-lg text-xs font-600 border transition-colors min-h-[36px]"
                                      style={{ borderColor: 'var(--border)', color: action.color, background: 'transparent' }}
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}

                            {reviewFeedback[s.id] && (
                              <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
                                {reviewFeedback[s.id]}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </section>

      {/* ── Submit work section ──────────────────────────────────────────────── */}
      {!isOwner && (
        <section>
          <h2
            className="display font-600 text-base mb-4"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            Submit Your Work
          </h2>

          {successId && (
            <div
              className="flex items-start gap-3 p-5 rounded-2xl border mb-4"
              style={{ background: 'var(--success-bg)', borderColor: 'rgba(26,122,69,0.25)' }}
            >
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
              <div>
                <p className="text-sm font-600" style={{ color: 'var(--success)' }}>Submission saved.</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Your work is stored locally and visible to the bounty owner. It will persist after refreshing.
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <div
              className="flex items-start gap-2 p-4 rounded-xl border mb-4"
              style={{ background: 'var(--danger-bg)', borderColor: 'rgba(192,54,77,0.22)' }}
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{submitError}</p>
            </div>
          )}

          {/* My submitted work status */}
          {alreadySubmitted && mySubmission && (
            <div
              className="p-5 rounded-2xl border"
              style={{
                background: mySubmission.status === 'paid'
                  ? 'var(--success-bg)'
                  : 'var(--surface)',
                borderColor: mySubmission.status === 'paid'
                  ? 'rgba(26,122,69,0.25)'
                  : 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-600" style={{ color: 'var(--ink)' }}>
                  Your submission
                </p>
                <SubmissionStatusBadge status={mySubmission.status} />
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                {mySubmission.status === 'paid'
                  ? 'Payment has been sent to your wallet.'
                  : mySubmission.status === 'approved'
                  ? 'Approved! Payment release is in progress.'
                  : mySubmission.status === 'revision_requested'
                  ? 'The creator has requested revisions.'
                  : mySubmission.status === 'rejected'
                  ? 'Your submission was not selected for this bounty.'
                  : mySubmission.status === 'under_review'
                  ? 'The creator is reviewing your submission.'
                  : 'Your submission is awaiting review.'}
              </p>
              {mySubmission.creatorNote && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl border mt-2"
                  style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}
                >
                  <MessageSquare size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--subtle)' }} />
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="font-600" style={{ color: 'var(--subtle)' }}>Creator: </span>
                    {mySubmission.creatorNote}
                  </p>
                </div>
              )}
              {mySubmission.txHash && (
                <a
                  href={`${explorer}/tx/${mySubmission.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs mt-3"
                  style={{ color: 'var(--success)' }}
                >
                  <CheckCircle2 size={12} />
                  Payout tx: {formatTxHash(mySubmission.txHash)}
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          {!alreadySubmitted && !isConnected && (
            <div
              className="flex items-center justify-between p-5 rounded-2xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to submit work.</p>
              <PrivyLoginButton variant="light" />
            </div>
          )}

          {!alreadySubmitted && isConnected && !canSubmit && (
            <div
              className="p-5 rounded-2xl border text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {isDraft
                  ? 'This bounty has not yet been funded. It is not accepting submissions until the owner deposits USDC into escrow.'
                  : isExpired
                  ? 'This bounty has expired and is no longer accepting submissions.'
                  : 'This bounty is no longer accepting submissions.'}
              </p>
            </div>
          )}

          {/* Confirm screen */}
          {showConfirm && canSubmit && (
            <div
              className="rounded-2xl border divide-y"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="p-5">
                <p className="display font-600 text-base mb-4" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  Review your submission
                </p>
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>BOUNTY</dt>
                    <dd style={{ color: 'var(--ink)' }}>{bounty.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>YOUR WALLET</dt>
                    <dd className="mono text-xs" style={{ color: 'var(--muted)' }}>{address}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>TITLE</dt>
                    <dd style={{ color: 'var(--ink)' }}>{formTitle.trim()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>DESCRIPTION</dt>
                    <dd style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{summary.trim()}</dd>
                  </div>
                  {deliverables.filter((d) => d.url.trim()).length > 0 && (
                    <div>
                      <dt className="text-xs font-600 mb-1" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>DELIVERABLES</dt>
                      <dd>{renderDeliverables(deliverables)}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="p-5 flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-600 border"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }}
                >
                  Edit
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  className="flex-1 py-3 rounded-xl text-sm font-600"
                  style={{ background: 'var(--accent)', color: '#ffffff' }}
                >
                  Confirm &amp; Submit
                </button>
              </div>
            </div>
          )}

          {/* Submission form */}
          {!showConfirm && canSubmit && !successId && (
            <form
              onSubmit={handleProceedToConfirm}
              className="rounded-2xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <label className="block text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                  SUBMISSION TITLE <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => { setFormTitle(e.target.value); setTitleError('') }}
                  placeholder="Brief title for your submission"
                  maxLength={MAX_TITLE_LEN}
                  className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
                  style={{
                    background: 'var(--surface-muted)',
                    borderColor: titleError ? 'var(--danger)' : 'var(--border)',
                    color: 'var(--ink)',
                  }}
                  onFocus={(e) => !titleError && (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => !titleError && (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <div className="flex justify-between mt-1.5">
                  {titleError ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{titleError}</p> : <span />}
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>{formTitle.length}/{MAX_TITLE_LEN}</p>
                </div>
              </div>

              <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <label className="block text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>
                  WORK DESCRIPTION <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => { setSummary(e.target.value); setSummaryError('') }}
                  placeholder="Explain what you built, how you approached it, and which acceptance criteria you met."
                  rows={6}
                  maxLength={MAX_SUMMARY_LEN}
                  className="w-full rounded-xl px-4 py-3 text-sm border outline-none resize-none"
                  style={{
                    background: 'var(--surface-muted)',
                    borderColor: summaryError ? 'var(--danger)' : 'var(--border)',
                    color: 'var(--ink)',
                  }}
                  onFocus={(e) => !summaryError && (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => !summaryError && (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <div className="flex justify-between mt-1.5">
                  {summaryError ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{summaryError}</p> : <span />}
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>{summary.length}/{MAX_SUMMARY_LEN}</p>
                </div>
              </div>

              <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-600" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>DELIVERABLE LINKS</label>
                  {deliverables.length < MAX_DELIVERABLES && (
                    <button
                      type="button"
                      onClick={addDeliverable}
                      className="flex items-center gap-1 text-xs font-600 px-2.5 py-1.5 rounded-lg border min-h-[32px]"
                      style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                    >
                      <Plus size={12} />
                      Add link
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {deliverables.map((d, idx) => (
                    <div key={idx}>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={d.label}
                          onChange={(e) => updateDeliverable(idx, 'label', e.target.value)}
                          placeholder="Label (e.g. GitHub repo)"
                          maxLength={60}
                          className="w-32 flex-shrink-0 px-3 py-2.5 rounded-xl text-xs border outline-none"
                          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                        />
                        <input
                          type="url"
                          value={d.url}
                          onChange={(e) => updateDeliverable(idx, 'url', e.target.value)}
                          placeholder="https://github.com/yourname/repo"
                          maxLength={MAX_URL_LEN}
                          className="flex-1 px-3 py-2.5 rounded-xl text-xs border outline-none"
                          style={{
                            background: 'var(--surface-muted)',
                            borderColor: urlErrors[idx] ? 'var(--danger)' : 'var(--border)',
                            color: 'var(--ink)',
                          }}
                        />
                        {deliverables.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDeliverable(idx)}
                            className="p-2 rounded-lg flex items-center justify-center min-h-[36px] min-w-[36px]"
                            style={{ color: 'var(--subtle)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {urlErrors[idx] && (
                        <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{urlErrors[idx]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl text-sm font-600 transition-colors min-h-[44px]"
                  style={{ background: 'var(--accent)', color: '#ffffff' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
                >
                  Review &amp; Submit
                </button>
                <p className="text-xs text-center mt-2" style={{ color: 'var(--subtle)' }}>
                  Submissions are stored locally and reviewed by the bounty owner. Payment is released onchain upon approval.
                </p>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ── Approval confirmation dialog ────────────────────────────────────── */}
      {pendingApproval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="rounded-2xl border w-full max-w-md p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2
              className="display font-700 text-lg mb-1"
              style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
            >
              Approve &amp; Release Payment
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              This will call two contract functions: first <span className="mono text-xs">approveContributor</span>, then <span className="mono text-xs">releasePayment</span>. Both require wallet signatures.
            </p>

            <dl className="flex flex-col gap-3 text-sm mb-5">
              <div>
                <dt className="text-xs font-600 mb-0.5" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>BOUNTY</dt>
                <dd style={{ color: 'var(--ink)' }}>{bounty.title}</dd>
              </div>
              <div>
                <dt className="text-xs font-600 mb-0.5" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>CONTRIBUTOR</dt>
                <dd className="mono text-xs" style={{ color: 'var(--muted)' }}>{pendingApproval.contributor}</dd>
              </div>
              <div>
                <dt className="text-xs font-600 mb-0.5" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>REWARD</dt>
                <dd className="flex items-center gap-1.5">
                  <TokenUSDC variant="branded" size={16} />
                  <span className="display font-700 tabular-nums" style={{ color: 'var(--accent)' }}>
                    {formatUsdcAmount(bounty.rewardRaw, receiptChainId)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-600 mb-0.5" style={{ color: 'var(--subtle)', letterSpacing: '0.06em' }}>SUBMISSION</dt>
                <dd style={{ color: 'var(--muted)' }}>{pendingApproval.title}</dd>
              </div>
            </dl>

            <div
              className="flex items-start gap-2 p-3 rounded-xl border mb-3"
              style={{ background: 'var(--danger-bg)', borderColor: 'rgba(192,54,77,0.22)' }}
            >
              <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                This action is irreversible. Once the payment is released, funds cannot be reclaimed.
              </p>
            </div>
            <div
              className="flex items-start gap-2 p-3 rounded-xl border mb-5"
              style={{ background: 'rgba(172,198,233,0.05)', borderColor: 'rgba(26,46,74,0.12)' }}
            >
              <Shield size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--subtle)' }} />
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                Verify the contributor address above before confirming. Submission data is stored locally —
                confirm the address matches the contributor you intended to reward.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPendingApproval(null)}
                className="flex-1 py-3 rounded-xl text-sm font-600 border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmApproval}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-600"
                style={{ background: 'rgba(26,122,69,0.12)', color: 'var(--success)', border: '1px solid rgba(26,122,69,0.3)' }}
              >
                <DollarSign size={15} />
                Approve &amp; Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel confirmation dialog ──────────────────────────────────────── */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="rounded-2xl border w-full max-w-md p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={18} style={{ color: 'var(--danger)' }} />
              <h2 className="display font-700 text-lg" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Cancel Bounty
              </h2>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              This will call <span className="mono text-xs">cancelBounty</span> on the contract, returning{' '}
              <span className="font-600" style={{ color: 'var(--ink)' }}>
                {formatUsdcAmount(bounty.rewardRaw, receiptChainId)} USDC
              </span>{' '}
              to your wallet. Any pending submissions will not be paid.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-600 border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }}
              >
                Keep Bounty
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-3 rounded-xl text-sm font-600"
                style={{ background: 'rgba(192,54,77,0.12)', color: 'var(--danger)', border: '1px solid rgba(192,54,77,0.28)' }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
