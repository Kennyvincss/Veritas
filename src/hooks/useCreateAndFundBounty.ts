/**
 * useCreateAndFundBounty — 3-step bounty creation flow driven by a React state machine.
 *
 *  Step 1: USDC approve(escrow, rewardAmount)  — only if allowance insufficient
 *  Step 2: createBounty(contentHash, reward, deadline)
 *  Step 3: fundBounty(bountyId)
 *
 * Each step advances only after on-chain confirmation from
 * useWaitForTransactionReceipt. "Never treat token approval as proof that
 * funding succeeded."
 *
 * The BountyCreated event topic is computed at module load so it doesn't
 * depend on viem's keccak at render time.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { erc20Abi, parseUnits, keccak256, toHex } from 'viem'
import {
  VERITAS_ESCROW_ABI,
  ARC_TESTNET_CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
  getEscrowAddress,
  isArcChain,
} from '@/contracts/VeritasEscrow'
import { computeContentHash, saveMeta } from './useOnchainBounties'

// BountyCreated(uint256 indexed bountyId, address indexed owner, uint256, uint256, bytes32)
const BOUNTY_CREATED_TOPIC = keccak256(
  toHex('BountyCreated(uint256,address,uint256,uint256,bytes32)'),
)

export type CreateFundStep =
  | 'idle'
  | 'approving'        // user needs to sign USDC approve tx
  | 'approve_pending'  // approve submitted — awaiting block confirmation
  | 'creating'         // user needs to sign createBounty tx
  | 'create_pending'   // createBounty submitted — awaiting confirmation
  | 'funding'          // user needs to sign fundBounty tx
  | 'fund_pending'     // fundBounty submitted — awaiting confirmation
  | 'success'          // fundBounty confirmed on-chain
  | 'error'

export interface CreateFundState {
  step: CreateFundStep
  error: string | null
  approveTxHash?: `0x${string}`
  createTxHash?: `0x${string}`
  fundTxHash?: `0x${string}`
  bountyId?: bigint
}

export interface CreateBountyParams {
  title: string
  description: string
  /** Human-readable USDC string, e.g. "50" = 50 USDC */
  rewardUsdc: string
  /** Unix timestamp (seconds) */
  deadline: number
}

// Parse a user-facing write-contract error into a plain string
function parseError(err: unknown): string {
  if (!err) return 'Unknown error.'
  const e = err as { shortMessage?: string; message?: string }
  const raw = e.shortMessage ?? e.message ?? 'Unknown error'
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request'))
    return '__USER_REJECTED__'
  if (lower.includes('insufficient'))
    return 'Insufficient USDC balance. Get test USDC from the sidebar.'
  if (lower.includes('zeroapprove') || lower.includes('zeroamount'))
    return 'Reward amount must be greater than zero.'
  if (lower.includes('deadlineinpast'))
    return 'Deadline must be in the future.'
  return raw.length > 200 ? raw.slice(0, 200) + '…' : raw
}

export function useCreateAndFundBounty() {
  const { address, chainId } = useAccount()
  // Resolve escrow address for the connected chain (testnet or mainnet)
  const escrowAddress = chainId !== undefined && isArcChain(chainId)
    ? getEscrowAddress(chainId)
    : undefined
  // Canonical chain ID to pass to wagmi hooks (fall back to testnet if unknown)
  const activeChainId = (chainId !== undefined && isArcChain(chainId) ? chainId : ARC_TESTNET_CHAIN_ID) as typeof ARC_TESTNET_CHAIN_ID

  const [step, setStep] = useState<CreateFundStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [createTxHash, setCreateTxHash] = useState<`0x${string}` | undefined>()
  const [fundTxHash, setFundTxHash] = useState<`0x${string}` | undefined>()
  const [bountyId, setBountyId] = useState<bigint | undefined>()

  // Keep pending params across async steps
  const pendingRef = useRef<{
    rewardRaw: bigint
    contentHash: `0x${string}`
    deadlineBig: bigint
    title: string
    description: string
  } | null>(null)

  // ── wagmi write hooks ─────────────────────────────────────────────────────
  const { writeContractAsync: writeApprove } = useWriteContract()
  const { writeContractAsync: writeCreate } = useWriteContract()
  const { writeContractAsync: writeFund } = useWriteContract()

  // ── USDC allowance ────────────────────────────────────────────────────────
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address ?? '0x0000000000000000000000000000000000000000', escrowAddress ?? '0x0000000000000000000000000000000000000000'],
    chainId: activeChainId,
    query: { enabled: !!address },
  })

  // ── Receipt watchers ──────────────────────────────────────────────────────
  const { data: approveReceipt, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    chainId: activeChainId,
  })

  const { data: createReceipt, isSuccess: createConfirmed } = useWaitForTransactionReceipt({
    hash: createTxHash,
    chainId: activeChainId,
  })

  const { isSuccess: fundConfirmed } = useWaitForTransactionReceipt({
    hash: fundTxHash,
    chainId: activeChainId,
  })

  // ── Step transitions via useEffect ───────────────────────────────────────

  // Approve confirmed → proceed to createBounty
  useEffect(() => {
    if (step !== 'approve_pending' || !approveConfirmed || !pendingRef.current) return
    const { contentHash, rewardRaw, deadlineBig } = pendingRef.current
    setStep('creating')
    writeCreate({
      address: escrowAddress!,
      abi: VERITAS_ESCROW_ABI,
      functionName: 'createBounty',
      args: [contentHash, rewardRaw, deadlineBig],
      chainId: activeChainId,
    })
      .then((hash) => {
        setCreateTxHash(hash)
        setStep('create_pending')
      })
      .catch((err) => {
        const msg = parseError(err)
        if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
        setStep('error'); setError(msg)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveConfirmed])

  // createBounty confirmed → extract bountyId → save meta → fundBounty
  useEffect(() => {
    if (step !== 'create_pending' || !createConfirmed || !createReceipt || !pendingRef.current) return
    const { title, description, contentHash } = pendingRef.current

    // Extract bountyId from BountyCreated event
    let extractedId: bigint | undefined
    for (const log of createReceipt.logs) {
      if (log.topics[0]?.toLowerCase() === BOUNTY_CREATED_TOPIC.toLowerCase() && log.topics[1]) {
        extractedId = BigInt(log.topics[1])
        break
      }
    }

    if (extractedId == null) {
      setStep('error')
      setError('Could not read bounty ID from transaction receipt.')
      return
    }

    setBountyId(extractedId)
    // Save title+description to localStorage, keyed by contentHash
    saveMeta(contentHash, { title, description })

    setStep('funding')
    writeFund({
      address: escrowAddress!,
      abi: VERITAS_ESCROW_ABI,
      functionName: 'fundBounty',
      args: [extractedId],
      chainId: activeChainId,
    })
      .then((hash) => {
        setFundTxHash(hash)
        setStep('fund_pending')
      })
      .catch((err) => {
        const msg = parseError(err)
        if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
        setStep('error'); setError(msg)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createConfirmed])

  // fundBounty confirmed → success
  useEffect(() => {
    if (step !== 'fund_pending' || !fundConfirmed) return
    setStep('success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundConfirmed])

  // ── Entry point ───────────────────────────────────────────────────────────
  const execute = useCallback(
    async (params: CreateBountyParams) => {
      if (!address) { setStep('error'); setError('Wallet not connected.'); return }
      if (!isArcChain(chainId) || !escrowAddress) {
        setStep('error')
        setError(
          !isArcChain(chainId)
            ? 'Please switch to Arc Testnet or Arc Mainnet.'
            : 'Contract not yet deployed on this network.',
        )
        return
      }

      const rewardRaw = parseUnits(params.rewardUsdc, USDC_DECIMALS)
      const contentHash = computeContentHash(params.title, params.description)
      const deadlineBig = BigInt(params.deadline)

      pendingRef.current = {
        rewardRaw, contentHash, deadlineBig,
        title: params.title, description: params.description,
      }

      setError(null)
      setApproveTxHash(undefined)
      setCreateTxHash(undefined)
      setFundTxHash(undefined)
      setBountyId(undefined)

      // Refresh allowance before deciding whether to approve
      const { data: freshAllowance } = await refetchAllowance()
      const allowance: bigint = typeof freshAllowance === 'bigint' ? freshAllowance : 0n

      if (allowance < rewardRaw) {
        // Need approval first
        setStep('approving')
        writeApprove({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, rewardRaw],
          chainId: activeChainId,
        })
          .then((hash) => {
            setApproveTxHash(hash)
            setStep('approve_pending')
          })
          .catch((err) => {
            const msg = parseError(err)
            if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
            setStep('error'); setError(msg)
          })
      } else {
        // Allowance already sufficient — skip to createBounty
        setStep('creating')
        writeCreate({
          address: escrowAddress,
          abi: VERITAS_ESCROW_ABI,
          functionName: 'createBounty',
          args: [contentHash, rewardRaw, deadlineBig],
          chainId: activeChainId,
        })
          .then((hash) => {
            setCreateTxHash(hash)
            setStep('create_pending')
          })
          .catch((err) => {
            const msg = parseError(err)
            if (msg === '__USER_REJECTED__') { setStep('idle'); setError(null); return }
            setStep('error'); setError(msg)
          })
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, chainId, allowanceData],
  )

  function reset() {
    setStep('idle'); setError(null)
    setApproveTxHash(undefined); setCreateTxHash(undefined)
    setFundTxHash(undefined); setBountyId(undefined)
    pendingRef.current = null
  }

  const isPending =
    step === 'approving' || step === 'approve_pending' ||
    step === 'creating' || step === 'create_pending' ||
    step === 'funding' || step === 'fund_pending'

  return {
    execute,
    reset,
    isPending,
    state: {
      step,
      error,
      approveTxHash,
      createTxHash,
      fundTxHash,
      bountyId,
    } satisfies CreateFundState,
    approveReceipt,
    createReceipt,
  }
}
