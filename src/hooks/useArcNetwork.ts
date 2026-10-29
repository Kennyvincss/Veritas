/**
 * useArcNetwork — wallet connection status and Arc chain validation.
 * Supports both Arc Testnet (5042002) and Arc Mainnet (5042).
 * Replaces useArcTestnet for multi-chain use; useArcTestnet is kept
 * as a compatibility re-export.
 */

import { useSwitchChain, useReadContract } from 'wagmi'
import { useAccount } from './useAccount'
import { erc20Abi } from 'viem'
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_MAINNET_CHAIN_ID,
  USDC_ADDRESS,
  isArcChain,
  getEscrowAddress,
  getExplorerBase,
} from '@/contracts/VeritasEscrow'

export interface ArcNetworkState {
  /** Connected wallet address, or undefined when disconnected. */
  address: `0x${string}` | undefined
  isConnected: boolean
  /** Connected chain ID, or undefined. */
  chainId: number | undefined
  /** True when the wallet is on Arc Testnet or Arc Mainnet. */
  isOnArc: boolean
  /** True when connected to Arc Mainnet specifically. */
  isMainnet: boolean
  /** True when connected to Arc Testnet specifically. */
  isTestnet: boolean
  isSwitching: boolean
  switchToTestnet: () => void
  switchToMainnet: () => void
  /** USDC ERC-20 balance (6 decimals) for the connected network. 0n when unavailable. */
  usdcBalance: bigint
  refetchBalance: () => unknown
  /** Escrow address for the current chain, or undefined if not yet deployed. */
  escrowAddress: `0x${string}` | undefined
  /** Block explorer base URL for the current chain. */
  explorerBase: string
  /**
   * True when the wallet is on an Arc chain but the escrow is not yet
   * deployed there (e.g. mainnet not yet deployed).
   */
  escrowNotDeployed: boolean
}

export function useArcNetwork(): ArcNetworkState {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const isOnArc = isArcChain(chainId)
  const isMainnet = chainId === ARC_MAINNET_CHAIN_ID
  const isTestnet = chainId === ARC_TESTNET_CHAIN_ID

  const escrowAddress = chainId !== undefined ? getEscrowAddress(chainId) : undefined
  const explorerBase = getExplorerBase(chainId ?? ARC_TESTNET_CHAIN_ID)
  const escrowNotDeployed = isOnArc && escrowAddress === undefined

  function switchToTestnet() {
    switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
  }

  function switchToMainnet() {
    switchChain({ chainId: ARC_MAINNET_CHAIN_ID })
  }

  // USDC ERC-20 balance (6 decimals) — only readable when on a supported chain
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: isMainnet ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && isOnArc },
  })

  return {
    address,
    isConnected,
    chainId,
    isOnArc,
    isMainnet,
    isTestnet,
    isSwitching,
    switchToTestnet,
    switchToMainnet,
    usdcBalance: typeof usdcBalance === 'bigint' ? usdcBalance : 0n,
    refetchBalance,
    escrowAddress,
    explorerBase,
    escrowNotDeployed,
  }
}
