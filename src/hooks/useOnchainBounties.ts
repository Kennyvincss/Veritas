/**
 * useOnchainBounties — reads all bounties from the VeritasEscrow contract.
 *
 * Strategy:
 *  1. Read `bountyCount` to know how many bounties exist.
 *  2. Read each bounty's onchain struct via `getBounty(id)`.
 *  3. Reconstruct offchain metadata (title, description) from localStorage,
 *     keyed by contentHash. The hash is computed onchain at create-time;
 *     the frontend stores title+description locally so they survive refresh.
 *
 * This is the correct architecture for a contract that stores only a
 * bytes32 contentHash onchain: the chain is the authoritative source for
 * financial state (owner, reward, status, deadline), and the local store
 * fills in human-readable text. Any bounty whose metadata is missing is
 * shown with a placeholder — it still appears in the listing.
 */

import { useReadContract, useReadContracts, useAccount } from 'wagmi'
import { keccak256, encodePacked } from 'viem'
import { useMemo, useEffect, useState } from 'react'
import {
  VERITAS_ESCROW_ABI,
  ARC_TESTNET_CHAIN_ID,
  CONTRACT_STATUS,
  getEscrowAddress,
  isArcChain,
} from '@/contracts/VeritasEscrow'
import type { Bounty, BountyStatus } from '@/types/bounty'

// ---------------------------------------------------------------------------
// Offchain metadata store (localStorage, keyed by contentHash hex string)
// ---------------------------------------------------------------------------

export interface BountyMeta {
  title: string
  description: string
}

const META_KEY = 'veritas_bounty_meta_v1'

export function loadAllMeta(): Record<string, BountyMeta> {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as Record<string, BountyMeta>
  } catch {
    return {}
  }
}

export function saveMeta(contentHash: string, meta: BountyMeta): void {
  const all = loadAllMeta()
  all[contentHash] = meta
  localStorage.setItem(META_KEY, JSON.stringify(all))
}

export function computeContentHash(title: string, description: string): `0x${string}` {
  return keccak256(encodePacked(['string', 'string'], [title, description]))
}

// ---------------------------------------------------------------------------
// Map contract uint8 status → frontend BountyStatus string
// ---------------------------------------------------------------------------

function toFrontendStatus(contractStatus: number): BountyStatus {
  switch (contractStatus) {
    case CONTRACT_STATUS.Created:
      // Bounty exists but USDC has NOT been deposited yet — must not accept submissions.
      return 'draft'
    case CONTRACT_STATUS.Funded:
      return 'open'
    case CONTRACT_STATUS.Approved:
      return 'in_review'
    case CONTRACT_STATUS.Paid:
      return 'completed'
    case CONTRACT_STATUS.Cancelled:
      return 'cancelled'
    default:
      return 'expired'
  }
}

// ---------------------------------------------------------------------------
// Hook: useOnchainBounties
// ---------------------------------------------------------------------------

export interface OnchainBountiesResult {
  bounties: Bounty[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useOnchainBounties(): OnchainBountiesResult {
  // Detect connected chain to select correct escrow address
  const { chainId: connectedChainId } = useAccount()
  // Fall back to testnet when wallet is disconnected or on an unsupported chain
  const activeChainId =
    connectedChainId !== undefined && isArcChain(connectedChainId)
      ? connectedChainId
      : ARC_TESTNET_CHAIN_ID
  const escrowAddress = getEscrowAddress(activeChainId)

  // Initialise directly from localStorage — avoids a setState-in-effect
  const [meta, setMeta] = useState<Record<string, BountyMeta>>(loadAllMeta)

  // Keep in sync when another tab writes to the same key
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === META_KEY) setMeta(loadAllMeta())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Step 1: read bountyCount — disabled when escrow not yet deployed on this chain
  const {
    data: bountyCount,
    isLoading: countLoading,
    error: countError,
    refetch: refetchCount,
  } = useReadContract({
    address: escrowAddress,
    abi: VERITAS_ESCROW_ABI,
    functionName: 'bountyCount',
    chainId: activeChainId,
    query: { enabled: !!escrowAddress },
  })

  const count = typeof bountyCount === 'bigint' ? Number(bountyCount) : 0

  // Step 2: read each bounty struct in parallel
  const contracts = useMemo(
    () =>
      escrowAddress
        ? Array.from({ length: count }, (_, i) => ({
            address: escrowAddress,
            abi: VERITAS_ESCROW_ABI,
            functionName: 'getBounty' as const,
            args: [BigInt(i + 1)] as const,
            chainId: activeChainId,
          }))
        : [],
    [count, escrowAddress, activeChainId],
  )

  const {
    data: rawBounties,
    isLoading: bountiesLoading,
    error: bountiesError,
    refetch: refetchBounties,
  } = useReadContracts({ contracts, query: { enabled: count > 0 && !!escrowAddress } })

  // Step 3: assemble frontend Bounty objects
  const bounties = useMemo<Bounty[]>(() => {
    if (!rawBounties || !escrowAddress) return []

    return rawBounties.flatMap((result, idx) => {
      if (result.status !== 'success' || !result.result) return []

      const raw = result.result

      const hashHex = raw.contentHash as string
      const stored = meta[hashHex]

      // approvedContributor is only meaningful in Approved or Paid state
      const hasApprovedContributor =
        raw.status === CONTRACT_STATUS.Approved || raw.status === CONTRACT_STATUS.Paid
      const approvedContributor: string | undefined =
        hasApprovedContributor && raw.approvedContributor !== '0x0000000000000000000000000000000000000000'
          ? (raw.approvedContributor)
          : undefined

      return [
        {
          id: String(idx + 1),
          owner: raw.owner,
          title: stored?.title ?? `Bounty #${idx + 1}`,
          description: stored?.description ?? '(description not available)',
          rewardRaw: raw.rewardAmount,
          deadline: Number(raw.deadline),
          status: toFrontendStatus(raw.status),
          approvedContributor,
          createdAt: Number(raw.deadline) - 30 * 86400, // approximation — not stored onchain
          contractAddress: escrowAddress,
        } satisfies Bounty,
      ]
    })
  }, [rawBounties, meta, escrowAddress])

  function refetch() {
    setMeta(loadAllMeta())
    void refetchCount()
    void refetchBounties()
  }

  const isLoading = countLoading || (count > 0 && bountiesLoading)
  const error = (countError ?? bountiesError) as Error | null

  return { bounties, isLoading, error, refetch }
}
