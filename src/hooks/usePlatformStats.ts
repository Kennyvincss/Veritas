/**
 * usePlatformStats — derives real platform statistics from live onchain and offchain data.
 * Never fabricates numbers. Shows only what can be verified.
 */

import { useMemo } from 'react'
import { USDC_DECIMALS } from '@/contracts/VeritasEscrow'
import type { Bounty, Submission } from '@/types/bounty'

export interface PlatformStats {
  totalBounties: number
  activeBounties: number       // status === 'open'
  completedBounties: number    // status === 'completed'
  cancelledBounties: number
  /** Total USDC funded into escrow (all Funded+Approved+Paid+Cancelled bounties), formatted */
  totalFundedUsdc: string
  /** Total USDC paid out to contributors (Paid bounties only), formatted */
  totalPaidUsdc: string
  /** Unique creator addresses */
  uniqueCreators: number
  /** Unique contributor addresses (anyone who submitted) */
  uniqueContributors: number
  /** Total submissions across all bounties */
  totalSubmissions: number
  /** Paid submissions */
  paidSubmissions: number
}

function formatUsdc(raw: bigint): string {
  const divisor = 10 ** USDC_DECIMALS
  const num = Number(raw) / divisor
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function usePlatformStats(
  bounties: Bounty[],
  submissions: Submission[],
): PlatformStats {
  return useMemo(() => {
    const activeBounties = bounties.filter((b) => b.status === 'open').length
    const completedBounties = bounties.filter((b) => b.status === 'completed').length
    const cancelledBounties = bounties.filter((b) => b.status === 'cancelled').length

    // Total funded = all bounties that had USDC deposited (Funded, Approved, Paid, Cancelled)
    const fundedStatuses = new Set(['open', 'in_review', 'completed', 'cancelled'])
    const totalFunded = bounties
      .filter((b) => fundedStatuses.has(b.status))
      .reduce((sum, b) => sum + b.rewardRaw, 0n)

    // Total paid = only completed bounties
    const totalPaid = bounties
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + b.rewardRaw, 0n)

    const uniqueCreators = new Set(bounties.map((b) => b.owner.toLowerCase())).size
    const uniqueContributors = new Set(
      submissions.map((s) => s.contributor.toLowerCase()),
    ).size

    const paidSubmissions = submissions.filter((s) => s.status === 'paid').length

    return {
      totalBounties: bounties.length,
      activeBounties,
      completedBounties,
      cancelledBounties,
      totalFundedUsdc: formatUsdc(totalFunded),
      totalPaidUsdc: formatUsdc(totalPaid),
      uniqueCreators,
      uniqueContributors,
      totalSubmissions: submissions.length,
      paidSubmissions,
    }
  }, [bounties, submissions])
}
