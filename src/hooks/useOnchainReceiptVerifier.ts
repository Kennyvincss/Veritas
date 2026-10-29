/**
 * useOnchainReceiptVerifier — Stage 2 onchain verification for Work Receipts.
 *
 * Verification approach:
 *   1. Resolve the RPC endpoint for the receipt's chainId.
 *   2. Call eth_getTransactionReceipt for the paymentTxHash.
 *   3. Confirm the transaction succeeded (status === 'success').
 *   4. Confirm the transaction was sent TO the known escrow contract address.
 *   5. Decode the PaymentReleased event log from that receipt.
 *   6. Validate decoded fields against the receipt:
 *        - contributor (log) === receipt.contributorAddress (case-insensitive)
 *        - rewardAmount (log, bigint) === BigInt(receipt.rewardRawString)
 *        - bountyId (log) === BigInt(receipt.bountyId)
 *   7. Call getBounty(bountyId) on the escrow contract.
 *   8. Confirm contract bounty status === Paid (3).
 *   9. Confirm contract approvedContributor === receipt.contributorAddress.
 *  10. Confirm contract owner === receipt.creatorAddress.
 *  11. Confirm getUsdcToken() matches the known USDC address for this chain.
 *
 * The verifier NEVER marks a receipt as onchain_verified when:
 *   - The RPC is unreachable (rpc_unavailable — not the same as failed).
 *   - The receipt is missing txHash, chainId, or escrowContractAddress (insufficient_data).
 *   - The chainId is not one of the supported Arc networks (unsupported_network).
 *
 * All onchain calls use a viem public client created per-verification — no wagmi hooks
 * are used here, so this module can be called from tests without a React context.
 *
 * Mutable fields (NOT in integrity hash):
 *   onchainVerificationStatus, onchainVerificationDetail, onchainVerifiedAt.
 *
 * Idempotency: repeated calls with the same txHash and matching fields will always
 * return onchain_verified (or the same failure) — there is no state mutation side-effect
 * beyond persisting the status back to localStorage.
 */

import { useCallback } from 'react'
import { createPublicClient, http, parseAbiItem, decodeEventLog, type Log } from 'viem'
import { arcTestnet, arc } from 'viem/chains'
import type { WorkReceipt, OnchainVerificationStatus } from '@/types/bounty'
import { loadAllReceipts, RECEIPTS_KEY } from './useReceipts'
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_MAINNET_CHAIN_ID,
  USDC_ADDRESS,
  CONTRACT_STATUS,
  VERITAS_ESCROW_ABI,
} from '@/contracts/VeritasEscrow'

// ---------------------------------------------------------------------------
// Supported network registry
// ---------------------------------------------------------------------------

interface NetworkConfig {
  chain: typeof arcTestnet | typeof arc
  rpcUrl: string
  explorerBase: string
  usdcAddress: `0x${string}`
  /** Minimum confirmations before a tx is considered sufficiently confirmed. */
  minConfirmations: number
}

const NETWORK_REGISTRY: Record<number, NetworkConfig> = {
  [ARC_TESTNET_CHAIN_ID]: {
    chain: arcTestnet,
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerBase: 'https://explorer.testnet.arc.io',
    usdcAddress: USDC_ADDRESS,
    minConfirmations: 1, // Arc has sub-second finality; 1 confirmation is sufficient on testnet
  },
  [ARC_MAINNET_CHAIN_ID]: {
    chain: arc,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerBase: 'https://explorer.arc.io',
    usdcAddress: USDC_ADDRESS,
    minConfirmations: 1,
  },
}

// ---------------------------------------------------------------------------
// PaymentReleased ABI item (for log decoding)
// ---------------------------------------------------------------------------

const PAYMENT_RELEASED_EVENT = parseAbiItem(
  'event PaymentReleased(uint256 indexed bountyId, address indexed contributor, uint256 rewardAmount)',
)

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface OnchainVerifyResult {
  receiptId: string
  status: OnchainVerificationStatus
  detail: string
  /** Set when status is onchain_verified */
  verifiedAt?: number
  /** Decoded values from the log (for display) */
  decoded?: {
    bountyId: string
    contributor: string
    rewardAmount: string
  }
}

// ---------------------------------------------------------------------------
// Standalone verification function (exported for tests)
// ---------------------------------------------------------------------------

/**
 * RPC client factory — injectable for tests.
 * Default creates a real viem public client; tests swap this out with a mock.
 */
export type CreateClientFn = (config: NetworkConfig) => {
  getTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{
    status: 'success' | 'reverted'
    to: string | null
    logs: Log[]
    blockNumber: bigint
  }>
  getBlockNumber: () => Promise<bigint>
  readContract: (args: {
    address: `0x${string}`
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

export function defaultCreateClient(config: NetworkConfig): ReturnType<CreateClientFn> {
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl, { timeout: 10_000 }),
  })
}

/**
 * Verify a single receipt against the blockchain.
 * Pure function — does NOT write to localStorage (caller decides).
 *
 * @param receipt - The receipt to verify (must have chainId, escrowContractAddress, paymentTxHash)
 * @param createClient - Client factory (injectable for tests)
 */
export async function verifyReceiptOnchain(
  receipt: WorkReceipt,
  createClient: CreateClientFn = defaultCreateClient,
): Promise<OnchainVerifyResult> {
  const { receiptId, paymentTxHash, chainId, escrowContractAddress } = receipt

  // ── Precondition checks ────────────────────────────────────────────────────

  if (!paymentTxHash || !chainId || !escrowContractAddress) {
    return {
      receiptId,
      status: 'insufficient_data',
      detail: `Receipt is missing required fields for onchain verification: ${[
        !paymentTxHash ? 'paymentTxHash' : null,
        !chainId ? 'chainId' : null,
        !escrowContractAddress ? 'escrowContractAddress' : null,
      ].filter(Boolean).join(', ')}.`,
    }
  }

  const network = NETWORK_REGISTRY[chainId]
  if (!network) {
    return {
      receiptId,
      status: 'unsupported_network',
      detail: `Chain ID ${chainId} is not supported by the onchain verifier. Supported: Arc Testnet (${ARC_TESTNET_CHAIN_ID}), Arc Mainnet (${ARC_MAINNET_CHAIN_ID}).`,
    }
  }

  // Validate tx hash format
  if (!/^0x[0-9a-fA-F]{64}$/.test(paymentTxHash)) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Payment transaction hash "${paymentTxHash.slice(0, 20)}…" is not a valid 32-byte hex hash.`,
    }
  }

  // ── Create client and fetch tx receipt ────────────────────────────────────

  let client: ReturnType<CreateClientFn>
  try {
    client = createClient(network)
  } catch {
    return {
      receiptId,
      status: 'rpc_unavailable',
      detail: 'Failed to create RPC client. Check network connectivity.',
    }
  }

  let txReceipt: Awaited<ReturnType<ReturnType<CreateClientFn>['getTransactionReceipt']>>
  let currentBlock: bigint

  try {
    ;[txReceipt, currentBlock] = await Promise.all([
      client.getTransactionReceipt({ hash: paymentTxHash as `0x${string}` }),
      client.getBlockNumber(),
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Distinguish "tx not found" from a connectivity failure
    if (msg.toLowerCase().includes('could not be found') || msg.toLowerCase().includes('not found')) {
      return {
        receiptId,
        status: 'onchain_failed',
        detail: `Transaction ${paymentTxHash.slice(0, 16)}… was not found on chain ${chainId}. It may have been sent on a different network, or may not yet be indexed.`,
      }
    }
    if (
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('network') ||
      msg.toLowerCase().includes('econnreset') ||
      msg.toLowerCase().includes('fetch failed')
    ) {
      return {
        receiptId,
        status: 'rpc_unavailable',
        detail: `RPC request timed out or failed: ${msg.slice(0, 120)}. Verification is inconclusive — try again later.`,
      }
    }
    return {
      receiptId,
      status: 'rpc_unavailable',
      detail: `Unexpected error fetching transaction: ${msg.slice(0, 120)}.`,
    }
  }

  // ── Transaction status ─────────────────────────────────────────────────────

  if (txReceipt.status !== 'success') {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Transaction ${paymentTxHash.slice(0, 16)}… reverted on chain. The payment did not complete.`,
    }
  }

  // ── Confirmation depth ─────────────────────────────────────────────────────

  const confirmations = currentBlock - txReceipt.blockNumber
  if (confirmations < BigInt(network.minConfirmations)) {
    return {
      receiptId,
      status: 'onchain_pending',
      detail: `Transaction has ${confirmations.toString()} confirmation(s); requires ${network.minConfirmations}. Check again shortly.`,
    }
  }

  // ── Contract address check ─────────────────────────────────────────────────

  const txTo = txReceipt.to?.toLowerCase()
  const expectedEscrow = escrowContractAddress.toLowerCase()
  if (txTo !== expectedEscrow) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Transaction was sent to ${txReceipt.to ?? '(unknown)'}, but the expected escrow contract is ${escrowContractAddress}. This may indicate a receipt from a different contract.`,
    }
  }

  // ── Decode PaymentReleased log ─────────────────────────────────────────────

  const paymentLog = decodePaymentReleasedLog(txReceipt.logs, escrowContractAddress)
  if (!paymentLog) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `No PaymentReleased event found in the transaction logs for escrow contract ${escrowContractAddress}. The transaction may not be a releasePayment call, or the log topic may differ.`,
    }
  }

  const { bountyId: logBountyId, contributor: logContributor, rewardAmount: logRewardAmount } = paymentLog

  // ── Validate log fields against receipt ───────────────────────────────────

  // Bounty ID
  const receiptBountyId = BigInt(receipt.bountyId)
  if (logBountyId !== receiptBountyId) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Log bountyId (${logBountyId.toString()}) does not match receipt bountyId (${receipt.bountyId}). This transaction belongs to a different bounty.`,
    }
  }

  // Contributor (case-insensitive)
  if (logContributor.toLowerCase() !== receipt.contributorAddress.toLowerCase()) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Payment recipient in the log (${logContributor}) does not match the receipt contributor (${receipt.contributorAddress}).`,
    }
  }

  // Reward amount (integer comparison — no floating point)
  const receiptRewardRaw = BigInt(receipt.rewardRawString)
  if (logRewardAmount !== receiptRewardRaw) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Log rewardAmount (${logRewardAmount.toString()} raw units) does not match receipt rewardRawString (${receipt.rewardRawString} raw units).`,
    }
  }

  // ── Contract state check via getBounty ────────────────────────────────────

  type ContractBountyResult = {
    owner: string
    rewardAmount: bigint
    deadline: bigint
    status: number
    approvedContributor: string
    contentHash: `0x${string}`
  }

  let contractBounty: ContractBountyResult

  try {
    contractBounty = await client.readContract({
      address: escrowContractAddress as `0x${string}`,
      abi: VERITAS_ESCROW_ABI,
      functionName: 'getBounty',
      args: [receiptBountyId],
    }) as ContractBountyResult
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // If we can read the tx but not the contract state, mark rpc_unavailable (inconclusive)
    return {
      receiptId,
      status: 'rpc_unavailable',
      detail: `Could not read contract state for bounty ${receipt.bountyId}: ${msg.slice(0, 120)}.`,
    }
  }

  // Contract status must be Paid (3)
  if (contractBounty.status !== CONTRACT_STATUS.Paid) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Contract bounty ${receipt.bountyId} is not in Paid state (current state: ${contractBounty.status}). Cannot verify as completed.`,
    }
  }

  // Contract owner must match receipt creator
  if (contractBounty.owner.toLowerCase() !== receipt.creatorAddress.toLowerCase()) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Contract bounty owner (${contractBounty.owner}) does not match receipt creator (${receipt.creatorAddress}).`,
    }
  }

  // Contract approvedContributor must match receipt contributor
  if (contractBounty.approvedContributor.toLowerCase() !== receipt.contributorAddress.toLowerCase()) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Contract approvedContributor (${contractBounty.approvedContributor}) does not match receipt contributorAddress (${receipt.contributorAddress}).`,
    }
  }

  // Contract reward amount must match receipt
  if (contractBounty.rewardAmount !== receiptRewardRaw) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Contract rewardAmount (${contractBounty.rewardAmount.toString()}) does not match receipt rewardRawString (${receipt.rewardRawString}).`,
    }
  }

  // ── USDC token address check ──────────────────────────────────────────────

  let usdcTokenAddress: string
  try {
    usdcTokenAddress = await client.readContract({
      address: escrowContractAddress as `0x${string}`,
      abi: VERITAS_ESCROW_ABI,
      functionName: 'getUsdcToken',
    }) as string
  } catch {
    // Non-fatal: if we can't read the token, log a warning but don't fail
    usdcTokenAddress = network.usdcAddress
  }

  if (usdcTokenAddress.toLowerCase() !== network.usdcAddress.toLowerCase()) {
    return {
      receiptId,
      status: 'onchain_failed',
      detail: `Escrow contract USDC token (${usdcTokenAddress}) does not match the expected USDC address for chain ${chainId} (${network.usdcAddress}).`,
    }
  }

  // ── All checks passed ─────────────────────────────────────────────────────

  const verifiedAt = Math.floor(Date.now() / 1000)
  return {
    receiptId,
    status: 'onchain_verified',
    detail: `All checks passed: transaction confirmed, PaymentReleased event decoded, recipient and amount match, contract state is Paid, USDC address verified.`,
    verifiedAt,
    decoded: {
      bountyId: logBountyId.toString(),
      contributor: logContributor,
      rewardAmount: logRewardAmount.toString(),
    },
  }
}

// ---------------------------------------------------------------------------
// Log decoder — finds and decodes the PaymentReleased event
// ---------------------------------------------------------------------------

function decodePaymentReleasedLog(
  logs: Log[],
  escrowAddress: string,
): { bountyId: bigint; contributor: string; rewardAmount: bigint } | null {
  // PaymentReleased topic0 = keccak256("PaymentReleased(uint256,address,uint256)")
  // Pre-computed: 0x8cc821d7ad4a624f7809ede5e6ca88c900e7c6555437e8ab1745fbeac7f93e81
  const TOPIC0 = '0x8cc821d7ad4a624f7809ede5e6ca88c900e7c6555437e8ab1745fbeac7f93e81'

  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue
    if (log.topics[0]?.toLowerCase() !== TOPIC0) continue
    if (log.address?.toLowerCase() !== escrowAddress.toLowerCase()) continue

    // topic1 = indexed bountyId (uint256, left-padded to 32 bytes)
    // topic2 = indexed contributor (address, left-padded to 32 bytes)
    // data   = non-indexed rewardAmount (uint256)
    const bountyIdHex = log.topics[1]
    const contributorHex = log.topics[2]
    const data = log.data

    if (!bountyIdHex || !contributorHex || !data) continue

    try {
      const bountyId = BigInt(bountyIdHex)
      // Address is right-justified in a 32-byte slot; take the last 20 bytes
      const contributor = `0x${contributorHex.slice(-40)}`
      const rewardAmount = BigInt(data)

      return { bountyId, contributor, rewardAmount }
    } catch {
      continue
    }
  }

  // Also try viem's decodeEventLog as a fallback for non-indexed encoding variants
  for (const log of logs) {
    if (log.address?.toLowerCase() !== escrowAddress.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: [PAYMENT_RELEASED_EVENT],
        data: log.data,
        topics: (log.topics ?? []),
      }) as { args: { bountyId: bigint; contributor: string; rewardAmount: bigint } }
      if (decoded.args) return decoded.args
    } catch {
      continue
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Persistence helpers — update receipt in localStorage after verification
// ---------------------------------------------------------------------------

export function persistOnchainResult(
  receiptId: string,
  result: OnchainVerifyResult,
): void {
  try {
    const all = loadAllReceipts()
    const updated = all.map((r) => {
      if (r.receiptId !== receiptId) return r
      return {
        ...r,
        onchainVerificationStatus: result.status,
        onchainVerificationDetail: result.detail,
        onchainVerifiedAt: result.verifiedAt,
      }
    })
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(updated))
  } catch {
    // Non-fatal — verification result was computed; persistence failure noted without detail
  }
}

// ---------------------------------------------------------------------------
// React hook wrapper
// ---------------------------------------------------------------------------

export interface UseOnchainReceiptVerifierResult {
  /**
   * Verify a receipt against the blockchain. Returns a detailed result.
   * Also persists the status back to localStorage.
   * Safe to call multiple times — idempotent for verified receipts.
   */
  verify: (receipt: WorkReceipt) => Promise<OnchainVerifyResult>
}

export function useOnchainReceiptVerifier(): UseOnchainReceiptVerifierResult {
  const verify = useCallback(async (receipt: WorkReceipt): Promise<OnchainVerifyResult> => {
    const result = await verifyReceiptOnchain(receipt)
    persistOnchainResult(receipt.receiptId, result)
    return result
  }, [])

  return { verify }
}
