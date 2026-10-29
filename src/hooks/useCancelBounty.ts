/**
 * useCancelBounty — single-tx onchain cancel for eligible bounties.
 *
 * Contract: cancelBounty(bountyId)
 *   - Caller must be bounty owner.
 *   - Bounty must be in Funded or Approved state.
 *   - Refunds the full reward amount to the owner.
 *   - Bounty moves to Cancelled state.
 *
 * After confirmation: onCancelled() callback fires so the parent can refetch
 * the onchain bounty list and reflect the Cancelled status in the UI.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import {
  VERITAS_ESCROW_ABI,
  ARC_TESTNET_CHAIN_ID,
  getEscrowAddress,
  isArcChain,
} from '@/contracts/VeritasEscrow'

export type CancelStep =
  | 'idle'
  | 'cancelling'     // user signing cancelBounty tx
  | 'cancel_pending' // tx submitted — awaiting confirmation
  | 'success'        // confirmed; USDC refunded to owner
  | 'error'

export interface CancelState {
  step: CancelStep
  error: string | null
  txHash?: `0x${string}`
}

function parseError(err: unknown): string {
  if (!err) return 'Unknown error.'
  const e = err as { shortMessage?: string; message?: string }
  const raw = e.shortMessage ?? e.message ?? 'Unknown error'
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request'))
    return '__USER_REJECTED__'
  if (lower.includes('notbountyowner')) return 'Only the bounty owner can cancel.'
  if (lower.includes('invalidstatus')) return 'This bounty cannot be cancelled in its current state.'
  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw
}

export function useCancelBounty() {
  const { address, chainId } = useAccount()
  const escrowAddress = chainId !== undefined && isArcChain(chainId) ? getEscrowAddress(chainId) : undefined
  const activeChainId = (chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID) as typeof ARC_TESTNET_CHAIN_ID

  const [step, setStep] = useState<CancelStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [onCancelledRef, setOnCancelledRef] = useState<(() => void) | null>(null)

  const { writeContractAsync } = useWriteContract()

  const { data: receipt, isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: activeChainId,
  })

  useEffect(() => {
    if (step !== 'cancel_pending' || !confirmed || !receipt) return
    onCancelledRef?.()
    setStep('success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])

  const execute = useCallback(
    (bountyId: string, onCancelled?: () => void) => {
      if (!address) { setStep('error'); setError('Wallet not connected.'); return }
      if (!isArcChain(chainId) || !escrowAddress) { setStep('error'); setError(!isArcChain(chainId) ? 'Please switch to Arc Testnet or Arc Mainnet.' : 'Contract not deployed on this network.'); return }
      if (step !== 'idle' && step !== 'error') return

      setError(null)
      setTxHash(undefined)
      setOnCancelledRef(onCancelled ? () => onCancelled : null)

      setStep('cancelling')
      writeContractAsync({
        address: escrowAddress,
        abi: VERITAS_ESCROW_ABI,
        functionName: 'cancelBounty',
        args: [BigInt(bountyId)],
        chainId: activeChainId,
      })
        .then((hash) => {
          setTxHash(hash)
          setStep('cancel_pending')
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
    setTxHash(undefined)
    setOnCancelledRef(null)
  }

  const isPending = step === 'cancelling' || step === 'cancel_pending'

  return {
    execute,
    reset,
    isPending,
    state: { step, error, txHash } satisfies CancelState,
  }
}
