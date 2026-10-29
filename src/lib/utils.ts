import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { USDC_DECIMALS } from '@/contracts/VeritasEscrow'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Truncate a hex address for display: 0x1234...abcd */
export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Format a raw USDC amount (bigint, 6 decimals) to a display string like "$125.00" */
export function formatUsdcAmount(raw: bigint, _chainId: number): string {
  // USDC is 6 decimals on Arc (and all supported chains in this app)
  const divisor = 10 ** USDC_DECIMALS
  const num = Number(raw) / divisor
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format a Unix timestamp as a human-readable date */
export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Time remaining from now until a Unix deadline timestamp */
export function timeRemaining(deadlineTs: number): string {
  const now = Math.floor(Date.now() / 1000)
  const delta = deadlineTs - now
  if (delta <= 0) return 'Expired'
  const days = Math.floor(delta / 86400)
  const hours = Math.floor((delta % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h remaining`
  const mins = Math.floor((delta % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m remaining`
}

/** Shorten a tx hash for display */
export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 12) return hash
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`
}
