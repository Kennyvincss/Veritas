/**
 * VeritasEscrow contract config for wagmi/viem.
 * Address and ABI sourced directly from the deployed artifact — do not edit by hand.
 *
 * Testnet deployment: Arc Testnet (chainId 5042002)
 *   Address: 0xeb9ceb841559b47dd62b51a77f7d9767c76e1779
 *   USDC: 0x3600000000000000000000000000000000000000
 *
 * Mainnet deployment: Arc Mainnet (chainId 5042)
 *   Address: set VITE_ESCROW_ADDRESS_MAINNET in .env after deployment
 *   USDC: 0x3600000000000000000000000000000000000000 (same address, both networks)
 */

// ── Chain IDs ────────────────────────────────────────────────────────────────
export const ARC_TESTNET_CHAIN_ID = 5042002 as const
export const ARC_MAINNET_CHAIN_ID = 5042 as const

// ── USDC (same predeploy address on both Arc networks, 6 decimals ERC-20) ───
/** USDC ERC-20 address on Arc Testnet and Arc Mainnet */
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const
export const USDC_DECIMALS = 6

// ── Block explorer base URLs ─────────────────────────────────────────────────
export const ARC_TESTNET_EXPLORER = 'https://explorer.testnet.arc.io'
export const ARC_MAINNET_EXPLORER = 'https://explorer.arc.io'

// ── Escrow addresses per network ─────────────────────────────────────────────
/** Testnet: deployed address (env override or fallback to known address) */
export const ESCROW_ADDRESS_TESTNET = (
  import.meta.env.VITE_ESCROW_ADDRESS ?? '0xeb9ceb841559b47dd62b51a77f7d9767c76e1779'
) as `0x${string}`

/**
 * Mainnet: set VITE_ESCROW_ADDRESS_MAINNET in .env after deploying.
 * Returns undefined when not yet deployed — callers must check before use.
 */
export const ESCROW_ADDRESS_MAINNET = (
  import.meta.env.VITE_ESCROW_ADDRESS_MAINNET
    ? (import.meta.env.VITE_ESCROW_ADDRESS_MAINNET as `0x${string}`)
    : undefined
)

/** Returns the escrow address for the given chain ID, or undefined if not deployed. */
export function getEscrowAddress(chainId: number): `0x${string}` | undefined {
  if (chainId === ARC_TESTNET_CHAIN_ID) return ESCROW_ADDRESS_TESTNET
  if (chainId === ARC_MAINNET_CHAIN_ID) return ESCROW_ADDRESS_MAINNET
  return undefined
}

/** Returns the block explorer base URL for the given chain ID. */
export function getExplorerBase(chainId: number): string {
  if (chainId === ARC_MAINNET_CHAIN_ID) return ARC_MAINNET_EXPLORER
  return ARC_TESTNET_EXPLORER
}

/** True when the given chain ID is one of the supported Arc networks. */
export function isArcChain(chainId: number | undefined): boolean {
  return chainId === ARC_TESTNET_CHAIN_ID || chainId === ARC_MAINNET_CHAIN_ID
}

/**
 * Legacy single-chain alias: testnet escrow address.
 * Kept for any existing code that imports ESCROW_ADDRESS directly.
 * @deprecated Use getEscrowAddress(chainId) for multi-chain support.
 */
export const ESCROW_ADDRESS = ESCROW_ADDRESS_TESTNET

/** Numeric bounty status matching BountyStatus enum order in the contract */
export const CONTRACT_STATUS = {
  Created: 0,
  Funded: 1,
  Approved: 2,
  Paid: 3,
  Cancelled: 4,
} as const

export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS]

export const VERITAS_ESCROW_ABI = [
  {
    type: 'constructor',
    inputs: [{ name: 'usdcToken_', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createBounty',
    inputs: [
      { name: 'contentHash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'rewardAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'bountyId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fundBounty',
    inputs: [{ name: 'bountyId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveContributor',
    inputs: [
      { name: 'bountyId', type: 'uint256', internalType: 'uint256' },
      { name: 'contributor', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releasePayment',
    inputs: [{ name: 'bountyId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelBounty',
    inputs: [{ name: 'bountyId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBounty',
    inputs: [{ name: 'bountyId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: 'bounty',
        type: 'tuple',
        internalType: 'struct VeritasEscrow.Bounty',
        components: [
          { name: 'owner', type: 'address', internalType: 'address' },
          { name: 'rewardAmount', type: 'uint256', internalType: 'uint256' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
          { name: 'status', type: 'uint8', internalType: 'enum VeritasEscrow.BountyStatus' },
          { name: 'approvedContributor', type: 'address', internalType: 'address' },
          { name: 'contentHash', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bountyCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bounties',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'rewardAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'status', type: 'uint8', internalType: 'enum VeritasEscrow.BountyStatus' },
      { name: 'approvedContributor', type: 'address', internalType: 'address' },
      { name: 'contentHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUsdcToken',
    inputs: [],
    outputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'BountyCreated',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'rewardAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'contentHash', type: 'bytes32', indexed: false, internalType: 'bytes32' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BountyFunded',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'rewardAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ContributorApproved',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'contributor', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PaymentReleased',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'contributor', type: 'address', indexed: true, internalType: 'address' },
      { name: 'rewardAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BountyCancelled',
    inputs: [
      { name: 'bountyId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'rewardAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  // Errors
  { type: 'error', name: 'BountyNotFound', inputs: [] },
  { type: 'error', name: 'DeadlineInPast', inputs: [] },
  { type: 'error', name: 'NotBountyOwner', inputs: [] },
  { type: 'error', name: 'OwnerCannotBeContributor', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  {
    type: 'error',
    name: 'InvalidStatus',
    inputs: [
      { name: 'current', type: 'uint8', internalType: 'enum VeritasEscrow.BountyStatus' },
      { name: 'requiredOne', type: 'uint8', internalType: 'enum VeritasEscrow.BountyStatus' },
      { name: 'requiredTwo', type: 'uint8', internalType: 'enum VeritasEscrow.BountyStatus' },
    ],
  },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
  },
] as const
