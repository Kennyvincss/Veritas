/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet, arc } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Arc Mainnet RPC (official — https://docs.arc.io)
const ARC_MAINNET_RPC = 'https://rpc.mainnet.arc.io'
// Arc Testnet RPC (official — https://docs.arc.io)
const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.io'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, ARC_TESTNET_RPC)
registerChain(arc.id, ARC_MAINNET_RPC)

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_TESTNET_RPC),
    [arc.id]: http(ARC_MAINNET_RPC),
    [mainnet.id]: http(), // ENS resolution only
  },
})
