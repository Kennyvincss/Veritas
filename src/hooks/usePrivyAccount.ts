/**
 * usePrivyAccount — bridges Privy auth to the rest of the app.
 *
 * When VITE_PRIVY_APP_ID is set, reads the connected wallet from Privy.
 * Falls back to a disconnected stub when Privy is not configured.
 * All existing hooks can call usePrivyAccount() for address/isConnected/chainId.
 */

import { usePrivy, useWallets } from '@privy-io/react-auth'

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined

export interface PrivyAccountResult {
  address: `0x${string}` | undefined
  isConnected: boolean
  chainId: number | undefined
  isPrivy: boolean
  login: () => void
  logout: () => void
  displayName: string | null
  avatarUrl: string | null
}

function formatShortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function usePrivyAccount(): PrivyAccountResult {
  const isPrivy = !!PRIVY_APP_ID

  if (!isPrivy) {
    return {
      address: undefined,
      isConnected: false,
      chainId: undefined,
      isPrivy: false,
      login: () => {},
      logout: () => {},
      displayName: null,
      avatarUrl: null,
    }
  }

  // These are always safe to call inside PrivyProvider
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { ready, authenticated, login, logout, user } = usePrivy()
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { wallets } = useWallets()

  // Prefer the Privy embedded wallet; fall back to first connected wallet
  const embedded = wallets.find((w) => w.walletClientType === 'privy')
  const active = embedded ?? wallets[0]
  const embeddedAddress = active?.address as `0x${string}` | undefined

  // Google profile info (typed loosely via unknown cast to avoid Privy's internal types)
  const googleLinked = user?.linkedAccounts?.find((a) => (a as { type: string }).type === 'google_oauth') as
    | { name?: string; email?: string; subject?: string }
    | undefined

  const displayName: string | null =
    googleLinked?.name
    ?? googleLinked?.email
    ?? (embeddedAddress ? formatShortAddress(embeddedAddress) : null)

  // Wrap async logout as void to avoid promise-in-void-attribute lint
  const handleLogout = () => { void logout() }

  return {
    address: embeddedAddress,
    isConnected: ready && authenticated && !!embeddedAddress,
    chainId: 5042002,
    isPrivy: true,
    login,
    logout: handleLogout,
    displayName,
    avatarUrl: null, // Privy v3 does not expose profile pictures in the user object
  }
}
