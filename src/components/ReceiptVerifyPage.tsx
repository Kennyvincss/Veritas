/**
 * ReceiptVerifyPage — Stage 2
 *
 * Two independent verification panels:
 *
 *   1. Receipt Integrity (Stage 1)
 *      Recomputes the SHA-256 hash of the immutable fields and compares it to
 *      the stored integrityHash. Confirms the receipt data has not been tampered
 *      with in localStorage since it was created.
 *
 *   2. Onchain Verification (Stage 2)
 *      Fetches eth_getTransactionReceipt for the paymentTxHash, decodes the
 *      PaymentReleased event, validates recipient, amount, bountyId, contract
 *      state (Paid), owner, and USDC token address. Confirms the payment
 *      actually happened on the correct blockchain with the correct parameters.
 *
 * Display statuses (per panel):
 *   Integrity:  Verified | Verification Failed | Pending | Checking…
 *   Onchain:    Verified | Failed | Pending confirmation | RPC unavailable |
 *               Insufficient data | Unsupported network | Not checked | Checking…
 *
 * Only "Verified" is shown when checks actually pass.
 * RPC unavailability is clearly distinguished from a failed check.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, XCircle, Clock, ExternalLink, Copy, Check,
  ArrowLeft, AlertTriangle, FileText, RefreshCw, Wifi, WifiOff, Info,
} from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { VeriPayLogo } from './VeriPayLogo'
import { useReceipts, type ReceiptVerifyResult } from '@/hooks/useReceipts'
import { useOnchainReceiptVerifier, type OnchainVerifyResult } from '@/hooks/useOnchainReceiptVerifier'
import { formatDate, formatUsdcAmount, formatAddress } from '@/lib/utils'
import type {
  WorkReceipt,
  ReceiptVerificationStatus,
  OnchainVerificationStatus,
} from '@/types/bounty'
import { ARC_TESTNET_CHAIN_ID, ARC_MAINNET_CHAIN_ID } from '@/contracts/VeritasEscrow'
import { buildShareLink } from '@/lib/share'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function explorerForChain(chainId: number): string {
  if (chainId === ARC_MAINNET_CHAIN_ID) return 'https://explorer.arc.io'
  return 'https://explorer.testnet.arc.io'
}

function chainName(chainId: number): string {
  if (chainId === ARC_MAINNET_CHAIN_ID) return 'Arc Mainnet'
  if (chainId === ARC_TESTNET_CHAIN_ID) return 'Arc Testnet'
  return `Chain ${chainId}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type PanelStatus = 'checking' | 'pass' | 'fail' | 'warn' | 'info'

interface VerificationPanelProps {
  title: string
  statusLabel: string
  statusDesc: string
  panelStatus: PanelStatus
  children?: React.ReactNode
  onRetry?: () => void
  retrying?: boolean
}

function VerificationPanel({
  title, statusLabel, statusDesc, panelStatus, children, onRetry, retrying,
}: VerificationPanelProps) {
  const cfg = {
    checking: { icon: Clock, color: 'var(--subtle)', bg: 'rgba(26,46,74,0.04)' },
    pass:     { icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
    fail:     { icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
    warn:     { icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-bg)' },
    info:     { icon: Info, color: 'var(--accent)', bg: 'var(--accent-soft)' },
  }[panelStatus]

  const Icon = retrying ? RefreshCw : cfg.icon

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Panel header */}
      <div className="px-5 pt-5 pb-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <p className="font-700 text-sm" style={{ color: 'var(--ink)' }}>{title}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-600"
            style={{ background: 'var(--surface-muted)', color: 'var(--accent)', opacity: retrying ? 0.5 : 1 }}
          >
            <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Checking…' : 'Re-check'}
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: cfg.bg }}>
          <Icon
            size={18}
            color={cfg.color}
            className={`flex-shrink-0 mt-0.5 ${retrying ? 'animate-spin' : ''}`}
          />
          <div className="min-w-0">
            <p className="font-700 text-sm" style={{ color: cfg.color }}>{statusLabel}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{statusDesc}</p>
          </div>
        </div>
      </div>

      {/* Detail rows */}
      {children && <div className="px-5 py-3">{children}</div>}
    </div>
  )
}

function DetailRow({ label, value, mono, copy, explorerHref }: {
  label: string; value?: string; mono?: boolean; copy?: boolean; explorerHref?: string
}) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  function handleCopy() {
    void navigator.clipboard.writeText(value!).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="py-2.5 border-b last:border-b-0 flex items-start gap-2" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-600 flex-shrink-0 w-44 pt-px" style={{ color: 'var(--subtle)', letterSpacing: '0.04em' }}>
        {label.toUpperCase()}
      </p>
      <p
        className={`text-xs flex-1 min-w-0 break-all ${mono ? 'mono' : ''}`}
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </p>
      {copy && (
        <button onClick={handleCopy} className="flex-shrink-0 p-0.5" style={{ color: copied ? 'var(--success)' : 'var(--subtle)' }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      )}
      {explorerHref && (
        <a href={explorerHref} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-0.5 text-xs font-600"
          style={{ color: 'var(--accent)' }}>
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Integrity panel status mapper
// ---------------------------------------------------------------------------

function integrityPanelStatus(
  checking: boolean,
  status: ReceiptVerificationStatus | undefined,
): PanelStatus {
  if (checking) return 'checking'
  if (status === 'hash_verified') return 'pass'
  if (status === 'hash_mismatch') return 'fail'
  return 'warn'
}

function integrityLabel(checking: boolean, status: ReceiptVerificationStatus | undefined): string {
  if (checking) return 'Checking integrity…'
  if (status === 'hash_verified') return 'Integrity Verified'
  if (status === 'hash_mismatch') return 'Integrity Check Failed'
  return 'Pending'
}

function integrityDesc(checking: boolean, status: ReceiptVerificationStatus | undefined): string {
  if (checking) return 'Recomputing the SHA-256 integrity hash…'
  if (status === 'hash_verified') return 'The receipt\'s canonical hash matches the stored hash. No fields have been modified since this receipt was created.'
  if (status === 'hash_mismatch') return 'The recomputed hash does not match the stored hash. One or more immutable receipt fields may have been altered.'
  return 'Integrity check not yet performed. Refresh to verify.'
}

// ---------------------------------------------------------------------------
// Onchain panel status mapper
// ---------------------------------------------------------------------------

function onchainPanelStatus(checking: boolean, status: OnchainVerificationStatus): PanelStatus {
  if (checking) return 'checking'
  if (status === 'onchain_verified') return 'pass'
  if (status === 'onchain_failed') return 'fail'
  if (status === 'onchain_pending') return 'warn'
  if (status === 'rpc_unavailable') return 'warn'
  if (status === 'insufficient_data') return 'info'
  if (status === 'unsupported_network') return 'info'
  return 'info' // not_checked
}

function onchainLabel(checking: boolean, status: OnchainVerificationStatus): string {
  if (checking) return 'Verifying onchain…'
  switch (status) {
    case 'onchain_verified':    return 'Onchain Verified'
    case 'onchain_failed':      return 'Onchain Verification Failed'
    case 'onchain_pending':     return 'Pending Confirmation'
    case 'rpc_unavailable':     return 'RPC Unavailable — Inconclusive'
    case 'insufficient_data':   return 'Insufficient Data'
    case 'unsupported_network': return 'Unsupported Network'
    case 'not_checked':         return 'Not Checked Yet'
    default:                    return 'Not Checked'
  }
}

// ---------------------------------------------------------------------------
// ReceiptVerifyPage
// ---------------------------------------------------------------------------

interface ReceiptVerifyPageProps {
  receiptId: string
  onBack: () => void
  onSelectBounty?: (id: string) => void
}

export function ReceiptVerifyPage({ receiptId, onBack, onSelectBounty }: ReceiptVerifyPageProps) {
  const { getReceipt, verifyReceipt, refresh } = useReceipts()
  const { verify: verifyOnchain } = useOnchainReceiptVerifier()

  // ── Integrity state ───────────────────────────────────────────────────────
  const [checkingIntegrity, setCheckingIntegrity] = useState(true)
  const [integrityResult, setIntegrityResult] = useState<ReceiptVerifyResult | null>(null)

  // ── Onchain state ─────────────────────────────────────────────────────────
  const [checkingOnchain, setCheckingOnchain] = useState(false)
  const [onchainResult, setOnchainResult] = useState<OnchainVerifyResult | null>(null)

  // ── Share ─────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)

  // Live receipt from hook (re-reads after verification updates localStorage)
  const receipt: WorkReceipt | undefined = getReceipt(receiptId)

  // ── Run integrity check on mount ──────────────────────────────────────────
  const runIntegrityCheck = useCallback(() => {
    if (!receiptId) return
    setCheckingIntegrity(true)
    setIntegrityResult(null)
    void verifyReceipt(receiptId).then((result) => {
      setIntegrityResult(result)
      setCheckingIntegrity(false)
      refresh()
    })
  }, [receiptId, verifyReceipt, refresh])

  // Mount effect — use a ref to track if already triggered to avoid double-run in StrictMode
  const integrityRanRef = React.useRef(false)
  useEffect(() => {
    if (integrityRanRef.current) return
    integrityRanRef.current = true
    void Promise.resolve().then(runIntegrityCheck)
  }, [runIntegrityCheck])

  // ── Run onchain check ─────────────────────────────────────────────────────
  const runOnchainCheck = useCallback(() => {
    const r = getReceipt(receiptId)
    if (!r) return
    setCheckingOnchain(true)
    setOnchainResult(null)
    void verifyOnchain(r).then((result) => {
      setOnchainResult(result)
      setCheckingOnchain(false)
      refresh()
    })
  }, [receiptId, getReceipt, verifyOnchain, refresh])

  // Auto-run onchain check once receipt is loaded + integrity is done
  const onchainRanRef = React.useRef(false)
  useEffect(() => {
    if (checkingIntegrity || !receipt || onchainResult !== null || checkingOnchain) return
    if (onchainRanRef.current) return
    onchainRanRef.current = true
    void Promise.resolve().then(runOnchainCheck)
  }, [checkingIntegrity, receipt, onchainResult, checkingOnchain, runOnchainCheck])

  // Resolve share URL once using buildShareLink (handles Studio iframe / Vercel)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const shareUrlResolved = useRef(false)
  useEffect(() => {
    if (shareUrlResolved.current) return
    shareUrlResolved.current = true
    void buildShareLink(`/?receipt=${receiptId}`).then(setShareUrl)
  }, [receiptId])

  function handleCopyLink() {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!receipt && !checkingIntegrity) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <button onClick={onBack} className="flex items-center gap-2 text-sm mb-8" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(26,46,74,0.04)' }}>
            <XCircle size={26} color="var(--subtle)" />
          </div>
          <h1 className="display font-700 text-xl mb-2" style={{ color: 'var(--ink)' }}>Receipt Not Found</h1>
          <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
            No receipt with ID <span className="mono font-600">{receiptId}</span> was found.
          </p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Receipts are stored in browser localStorage and are not shared across devices or browsers.
          </p>
        </div>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (checkingIntegrity && !receipt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4" style={{ borderColor: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Verifying receipt…</p>
        </div>
      </div>
    )
  }

  if (!receipt) return null

  const explorerBase = explorerForChain(receipt.chainId)
  const rewardRaw = BigInt(receipt.rewardRawString)

  // Both checks pass = fully verified
  const fullyVerified =
    integrityResult?.intact === true &&
    receipt.onchainVerificationStatus === 'onchain_verified'

  const onchainStatus: OnchainVerificationStatus = onchainResult?.status ?? receipt.onchainVerificationStatus ?? 'not_checked'

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm mb-6"
        style={{ color: 'var(--muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Hero card */}
      <div
        className="rounded-2xl border p-6 mb-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-5 pb-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <VeriPayLogo size={40} />
          <div className="flex-1 min-w-0">
            <p className="display font-700 text-lg" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>VERIPAY</p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Proof-of-Work Receipt</p>
          </div>
          <FileText size={18} style={{ color: 'var(--subtle)' }} />
        </div>

        {/* Overall status pill */}
        {fullyVerified ? (
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5" style={{ background: 'var(--success-bg)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <p className="font-700 text-sm" style={{ color: 'var(--success)' }}>Fully Verified</p>
            <p className="text-xs ml-auto" style={{ color: 'var(--success)', opacity: 0.8 }}>Receipt integrity and onchain payment both confirmed</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5" style={{ background: 'rgba(26,46,74,0.04)' }}>
            <Wifi size={15} style={{ color: 'var(--subtle)' }} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {checkingIntegrity || checkingOnchain
                ? 'Running verification checks…'
                : 'See individual check results below.'}
            </p>
          </div>
        )}

        {/* Bounty title */}
        <h1 className="display font-700 text-xl mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          {receipt.bountyTitle}
        </h1>
        {onSelectBounty && (
          <button onClick={() => onSelectBounty(receipt.bountyId)} className="flex items-center gap-1 text-xs mb-5" style={{ color: 'var(--accent)' }}>
            View bounty #{receipt.bountyId} <ExternalLink size={11} />
          </button>
        )}

        {/* Reward */}
        <div className="flex items-center gap-3 rounded-xl p-4 mb-5" style={{ background: 'var(--accent-soft)' }}>
          <TokenUSDC variant="branded" size={28} />
          <div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Reward Paid</p>
            <p className="display font-700 text-2xl tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
              {formatUsdcAmount(rewardRaw, ARC_TESTNET_CHAIN_ID)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>Network</p>
            <p className="text-xs font-600 mono" style={{ color: 'var(--muted)' }}>{chainName(receipt.chainId)}</p>
          </div>
        </div>

        {/* Key fields */}
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          <DetailRow label="Receipt ID" value={receipt.receiptId} mono copy />
          <DetailRow label="Bounty ID" value={receipt.bountyId} mono />
          <DetailRow label="Completion Date" value={formatDate(receipt.completedAt)} />
          <DetailRow label="Receipt Created" value={formatDate(receipt.createdAt)} />
          <DetailRow label="Contributor" value={formatAddress(receipt.contributorAddress)} mono copy />
          <DetailRow label="Creator" value={formatAddress(receipt.creatorAddress)} mono copy />
          <DetailRow
            label="Payment Tx"
            value={receipt.paymentTxHash ? `${receipt.paymentTxHash.slice(0, 18)}…${receipt.paymentTxHash.slice(-6)}` : undefined}
            mono
            explorerHref={receipt.paymentTxHash ? `${explorerBase}/tx/${receipt.paymentTxHash}` : undefined}
          />
          <DetailRow label="Submission Ref" value={receipt.submissionId} mono />
          <DetailRow label="Content Hash" value={receipt.submissionContentHash} mono copy />
        </div>
      </div>

      {/* ── Two verification panels ─────────────────────────────────────── */}

      {/* Panel 1: Receipt Integrity */}
      <div className="mb-4">
        <VerificationPanel
          title="1. Receipt Integrity"
          panelStatus={integrityPanelStatus(checkingIntegrity, integrityResult?.status ?? receipt.verificationStatus)}
          statusLabel={integrityLabel(checkingIntegrity, integrityResult?.status ?? receipt.verificationStatus)}
          statusDesc={integrityDesc(checkingIntegrity, integrityResult?.status ?? receipt.verificationStatus)}
          onRetry={!checkingIntegrity ? runIntegrityCheck : undefined}
          retrying={checkingIntegrity}
        >
          {integrityResult && (
            <>
              <DetailRow
                label="Stored Hash"
                value={integrityResult.storedHash.slice(0, 24) + '…'}
                mono copy
              />
              <DetailRow
                label="Recomputed Hash"
                value={integrityResult.recomputedHash.slice(0, 24) + '…'}
                mono
              />
              <DetailRow
                label="Match"
                value={integrityResult.intact ? '✓ Hashes match' : '✗ Hashes differ'}
              />
            </>
          )}
          <div className="mt-3 flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}>
            <Info size={11} className="flex-shrink-0 mt-0.5" />
            <span>
              Integrity verification confirms the receipt data matches its SHA-256 hash. It does not independently
              prove the payment occurred onchain — see Panel 2 for that.
            </span>
          </div>
        </VerificationPanel>
      </div>

      {/* Panel 2: Onchain Verification */}
      <div className="mb-5">
        <VerificationPanel
          title="2. Onchain Verification"
          panelStatus={onchainPanelStatus(checkingOnchain, onchainStatus)}
          statusLabel={onchainLabel(checkingOnchain, onchainStatus)}
          statusDesc={onchainResult?.detail ?? receipt.onchainVerificationDetail ?? 'Click Re-check to verify the payment transaction on the blockchain.'}
          onRetry={!checkingOnchain ? runOnchainCheck : undefined}
          retrying={checkingOnchain}
        >
          {onchainStatus === 'onchain_verified' && (
            <>
              {receipt.onchainVerifiedAt && (
                <DetailRow label="Verified At" value={formatDate(receipt.onchainVerifiedAt)} />
              )}
              {onchainResult?.decoded && (
                <>
                  <DetailRow label="Decoded Bounty ID" value={onchainResult.decoded.bountyId} mono />
                  <DetailRow label="Decoded Contributor" value={formatAddress(onchainResult.decoded.contributor)} mono />
                  <DetailRow label="Decoded Amount" value={`${onchainResult.decoded.rewardAmount} raw units (6 decimals)`} mono />
                </>
              )}
              {receipt.paymentTxHash && (
                <div className="mt-2">
                  <a
                    href={`${explorerBase}/tx/${receipt.paymentTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-600"
                    style={{ color: 'var(--accent)' }}
                  >
                    <ExternalLink size={11} />
                    View transaction on {chainName(receipt.chainId)} explorer
                  </a>
                </div>
              )}
            </>
          )}
          {(onchainStatus === 'rpc_unavailable') && (
            <div className="mt-2 flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <WifiOff size={11} className="flex-shrink-0 mt-0.5" />
              <span>The RPC endpoint could not be reached. This does not mean verification failed — the result is inconclusive. Try again when connectivity is restored.</span>
            </div>
          )}
          {(onchainStatus === 'insufficient_data') && (
            <div className="mt-2 flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: 'var(--accent-soft)', color: 'var(--muted)' }}>
              <Info size={11} className="flex-shrink-0 mt-0.5" />
              <span>
                This receipt was created before Stage 2 onchain verification was available, or a required field is missing.
                {receipt.paymentTxHash && (
                  <> You can manually check the payment transaction on the <a href={`${explorerBase}/tx/${receipt.paymentTxHash}`} target="_blank" rel="noopener noreferrer" className="underline font-600">block explorer</a>.</>
                )}
              </span>
            </div>
          )}
          <div className="mt-3 flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}>
            <Info size={11} className="flex-shrink-0 mt-0.5" />
            <span>
              Onchain verification uses a live RPC call to check the transaction, decode the PaymentReleased event, and confirm the contract state.
              It does not release funds or execute any transaction.
            </span>
          </div>
        </VerificationPanel>
      </div>

      {/* Bounty description snapshot */}
      {receipt.bountyDescriptionSnapshot && (
        <div className="rounded-2xl border p-5 mb-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs font-600 mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.05em' }}>BOUNTY DESCRIPTION (SNAPSHOT AT COMPLETION)</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {receipt.bountyDescriptionSnapshot.slice(0, 600)}
            {receipt.bountyDescriptionSnapshot.length > 600 && '…'}
          </p>
        </div>
      )}

      {/* Share */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p className="text-sm font-600 mb-3" style={{ color: 'var(--ink)' }}>Share this receipt</p>
        <div className="flex items-center gap-2 rounded-xl p-3 border mb-3" style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}>
          <p className="text-xs mono flex-1 truncate" style={{ color: 'var(--muted)' }}>
            {shareUrl ?? 'Resolving link…'}
          </p>
        </div>
        <button
          onClick={handleCopyLink}
          disabled={!shareUrl}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 w-full justify-center"
          style={{
            background: copied ? 'var(--success-bg)' : 'var(--accent)',
            color: copied ? 'var(--success)' : '#fff',
            opacity: shareUrl ? 1 : 0.5,
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Link copied!' : 'Copy receipt link'}
        </button>
      </div>
    </div>
  )
}
