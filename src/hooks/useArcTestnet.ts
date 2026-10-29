/**
 * useArcTestnet — compatibility shim.
 * Delegates to useArcNetwork, which supports both Arc Testnet and Arc Mainnet.
 * Existing callers continue to work unchanged.
 */

import { useArcNetwork } from './useArcNetwork'
import { ARC_TESTNET_CHAIN_ID } from '@/contracts/VeritasEscrow'

export function useArcTestnet() {
  const net = useArcNetwork()

  return {
    address: net.address,
    isConnected: net.isConnected,
    /** True when the wallet is on any supported Arc network (testnet or mainnet). */
    isOnArc: net.isOnArc,
    isSwitching: net.isSwitching,
    /** Switches to Arc Testnet specifically. */
    switchToArc: net.switchToTestnet,
    usdcBalance: net.usdcBalance,
    refetchBalance: net.refetchBalance,
    /** @deprecated Use useArcNetwork().chainId for multi-chain support. */
    chainId: net.chainId ?? ARC_TESTNET_CHAIN_ID,
  }
}
