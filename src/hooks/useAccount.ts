/**
 * useAccount — compatibility shim.
 *
 * When VITE_PRIVY_APP_ID is set, returns the Privy embedded wallet as the
 * "connected account" so all existing contract hooks work unchanged.
 * When Privy is not configured, this is a no-op passthrough (returns nulls).
 *
 * Import this instead of wagmi's useAccount() in any component that needs
 * the connected address/chainId but does NOT call write/read contract hooks.
 * Contract-interaction hooks (useCreateAndFundBounty etc.) use wagmi
 * directly for signing — Privy exposes the wallet via its own provider.
 */

import { usePrivyAccount } from './usePrivyAccount'

export function useAccount() {
  const { address, isConnected, chainId } = usePrivyAccount()

  return {
    address,
    isConnected,
    chainId,
    // Stub fields used by wagmi consumers — safe to leave empty for UI purposes
    addresses: address ? [address] : ([] as readonly `0x${string}`[]),
    status: isConnected ? ('connected' as const) : ('disconnected' as const),
  }
}
