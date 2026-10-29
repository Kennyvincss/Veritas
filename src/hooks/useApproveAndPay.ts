/**
 * useApproveAndPay — two-step onchain flow for releasing a bounty reward.
 *
 * Also exports useReleasePayment — a single-step hook used when the bounty is
 * already in Approved state (approveContributor confirmed but tab was closed before
 * releasePayment was sent). This is the "resume payment" recovery path.
 *
 * Contract sequence (both calls are owner-only and enforced by VeritasEscrow):
 *
 *   Step 1: approveContributor(bountyId, contributorAddress)
 *           Bounty must be in Funded state. Sets approvedContributor → Approved.
 *
 *   Step 2: releasePayment(bountyId)
 *           Bounty must be in Approved state. Transfers USDC → contributor, → Paid.
 *
 * Payment is NEVER marked successful based solely on a tx hash or frontend state.
 * Both transactions must be confirmed onchain (useWaitForTransactionReceipt) before
 * the state machine advances.
 *
 * The submission record in localStorage is updated only after each on-chain
 * confirmation:
 *   - After Step 1 confirmed → markApproved(submissionId)
 *   - After Step 2 confirmed → markPaid(submissionId, releasePayment txHash)
 *
 * Duplicate-payout prevention: the contract reverts on any second call to
 * releasePayment for the same bountyId (it requires Approved status). The frontend
 * additionally gates the Approve button behind `bounty.status === 'open' | 'in_review'`
 * and hides it once the submission is already approved or paid.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import {
  VERITAS_ESCROW_ABI,
  ARC_TESTNET_CHAIN_ID,
  getEscrowAddress,
  isArcChain,
} from '@/contracts/VeritasEscrow'

// ── Step type ────────────────────────────────────────────────────────────────

export type ApprovePayStep =
  | 'idle'
  | 'approving'          // user needs to sign approveContributor tx
  | 'approve_pending'    // tx submitted — awaiting onchain confirmation
  | 'releasing'          // user needs to sign releasePayment tx
  | 'release_pending'    // tx submitted — awaiting onchain confirmation
  | 'success'            // releasePayment confirmed; contributor is paid
  | 'error'

export interface ApprovePayState {
  step: ApprovePayStep
  error: string | null
  approveTxHash?: `0x${string}`
  releaseTxHash?: `0x${string}`
}

// ── Error parser ─────────────────────────────────────────────────────────────

function parseError(err: unknown): string {
  if (!err) return 'Unknown error.'
  const e = err as { shortMessage?: string; message?: string }
  const raw = e.shortMessage ?? e.message ?? 'Unknown error'
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request'))
    return '__USER_REJECTED__'
  if (lower.includes('notbountyowner'))
    return 'Only the bounty owner can approve a submission.'
  if (lower.includes('invalidstatus'))
    return 'Bounty is not in the correct state for this action.'
  if (lower.includes('ownercannotbecontributor'))
    return 'The bounty owner cannot be approved as a contributor.'
  if (lower.includes('zeroaddress'))
    return 'Contributor address is invalid.'
  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface ApproveAndPayParams {
  bountyId: string            // uint256 as string
  contributorAddress: string  // address of the winning contributor
  submissionId: string        // offchain submission ID (for localStorage update)
  onApproved?: () => void     // called after approveContributor confirmed
  onPaid?: (txHash: string) => void  // called after releasePayment confirmed
}

export function useApproveAndPay() {
  const { address, chainId } = useAccount()
  const escrowAddress = chainId !== undefined && isArcChain(chainId) ? getEscrowAddress(chainId) : undefined
  const activeChainId = (chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID) as typeof ARC_TESTNET_CHAIN_ID

  const [step, setStep] = useState<ApprovePayStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [releaseTxHash, setReleaseTxHash] = useState<`0x${string}` | undefined>()

  // Keep params across async steps
  const pendingRef = useRef<ApproveAndPayParams | null>(null)
  // Guard against double-triggers from StrictMode
  const lockRef = useRef(false)

  const { writeContractAsync: writeApprove } = useWriteContract()
  const { writeContractAsync: writeRelease } = useWriteContract()

  // Receipt watchers
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    chainId: activeChainId,
  })

  const { data: releaseReceipt, isSuccess: releaseConfirmed } = useWaitForTransactionReceipt({
    hash: releaseTxHash,
    chainId: activeChainId,
  })

  // Step 1 confirmed → call releasePayment
  useEffect(() => {
    if (step !== 'approve_pending' || !approveConfirmed || !pendingRef.current || lockRef.current) return
    lockRef.current = true

    const { bountyId, onApproved } = pendingRef.current
    onApproved?.()

    setStep('releasing')
    writeRelease({
      address: escrowAddress!,
      abi: VERITAS_ESCROW_ABI,
      functionName: 'releasePayment',
      args: [BigInt(bountyId)],
      chainId: activeChainId,
    })
      .then((hash) => {
        setReleaseTxHash(hash)
        setStep('release_pending')
        lockRef.current = false
      })
      .catch((err: unknown) => {
        const msg = parseError(err)
        lockRef.current = false
        if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
        setStep('error'); setError(msg)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed])

  // Step 2 confirmed → success, update submission
  useEffect(() => {
    if (step !== 'release_pending' || !releaseConfirmed || !releaseReceipt || !pendingRef.current) return
    const { onPaid } = pendingRef.current
    const txHash = releaseReceipt.transactionHash
    onPaid?.(txHash)
    setStep('success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseConfirmed])

  // ── Entry point ───────────────────────────────────────────────────────────

  const execute = useCallback(
    (params: ApproveAndPayParams) => {
      if (!address) { setStep('error'); setError('Wallet not connected.'); return }
      if (!isArcChain(chainId) || !escrowAddress) {
        setStep('error')
        setError(!isArcChain(chainId) ? 'Please switch to Arc Testnet or Arc Mainnet.' : 'Contract not deployed on this network.')
        return
      }
      if (step !== 'idle' && step !== 'error') return // already in flight

      pendingRef.current = params
      lockRef.current = false
      setError(null)
      setApproveTxHash(undefined)
      setReleaseTxHash(undefined)

      setStep('approving')
      writeApprove({
        address: escrowAddress,
        abi: VERITAS_ESCROW_ABI,
        functionName: 'approveContributor',
        args: [BigInt(params.bountyId), params.contributorAddress as `0x${string}`],
        chainId: activeChainId,
      })
        .then((hash) => {
          setApproveTxHash(hash)
          setStep('approve_pending')
        })
        .catch((err: unknown) => {
          const msg = parseError(err)
          if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
          setStep('error'); setError(msg)
        })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, chainId, step],
  )

  function reset() {
    setStep('idle')
    setError(null)
    setApproveTxHash(undefined)
    setReleaseTxHash(undefined)
    pendingRef.current = null
    lockRef.current = false
  }

  const isPending =
    step === 'approving' ||
    step === 'approve_pending' ||
    step === 'releasing' ||
    step === 'release_pending'

  return {
    execute,
    reset,
    isPending,
    state: {
      step,
      error,
      approveTxHash,
      releaseTxHash,
    } satisfies ApprovePayState,
  }
}

// ── useReleasePayment ─────────────────────────────────────────────────────────
// Single-step resume path: the bounty is already Approved onchain; just call
// releasePayment(bountyId). Used when the two-step flow was interrupted after step 1.

export type ReleaseStep = 'idle' | 'releasing' | 'release_pending' | 'success' | 'error'

export interface ReleaseState {
  step: ReleaseStep
  error: string | null
  txHash?: `0x${string}`
}

export interface ReleasePaymentParams {
  bountyId: string
  submissionId?: string
  onPaid?: (txHash: string) => void
}

export function useReleasePayment() {
  const { address, chainId } = useAccount()
  const escrowAddress = chainId !== undefined && isArcChain(chainId) ? getEscrowAddress(chainId) : undefined
  const activeChainId = (chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID) as typeof ARC_TESTNET_CHAIN_ID

  const [step, setStep] = useState<ReleaseStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const pendingRef = useRef<ReleasePaymentParams | null>(null)

  const { writeContractAsync } = useWriteContract()

  const { data: receipt, isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: activeChainId,
  })

  useEffect(() => {
    if (step !== 'release_pending' || !confirmed || !receipt || !pendingRef.current) return
    const { onPaid } = pendingRef.current
    onPaid?.(receipt.transactionHash)
    setStep('success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])

  const execute = useCallback(
    (params: ReleasePaymentParams) => {
      if (!address) { setStep('error'); setError('Wallet not connected.'); return }
      if (!isArcChain(chainId) || !escrowAddress) {
        setStep('error')
        setError(!isArcChain(chainId) ? 'Please switch to Arc Testnet or Arc Mainnet.' : 'Contract not deployed on this network.')
        return
      }
      if (step !== 'idle' && step !== 'error') return

      pendingRef.current = params
      setError(null)
      setTxHash(undefined)
      setStep('releasing')

      writeContractAsync({
        address: escrowAddress,
        abi: VERITAS_ESCROW_ABI,
        functionName: 'releasePayment',
        args: [BigInt(params.bountyId)],
        chainId: activeChainId,
      })
        .then((hash) => { setTxHash(hash); setStep('release_pending') })
        .catch((err: unknown) => {
          const msg = parseError(err)
          if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
          setStep('error'); setError(msg)
        })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, chainId, step],
  )

  function reset() {
    setStep('idle'); setError(null); setTxHash(undefined); pendingRef.current = null
  }

  return {
    execute,
    reset,
    isPending: step === 'releasing' || step === 'release_pending',
    state: { step, error, txHash } satisfies ReleaseState,
  }
}
