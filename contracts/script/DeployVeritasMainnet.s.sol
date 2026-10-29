// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VeritasEscrow} from "../VeritasEscrow.sol";

/**
 * @title DeployVeritasMainnet
 * @notice Deploys VeritasEscrow to Arc Mainnet with the canonical USDC predeploy address.
 *
 * Prerequisites (run these before this script):
 *   1. forge build  (ensure artifact is current)
 *   2. cast wallet import mainnet-deployer --interactive  (import key into encrypted keystore)
 *
 * Run:
 *   forge script contracts/script/DeployVeritasMainnet.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --account mainnet-deployer \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * After successful deploy:
 *   1. Record the deployed address printed to stdout.
 *   2. Add VITE_ESCROW_ADDRESS_MAINNET=<address> to .env (never commit this file).
 *   3. Rebuild the frontend: bun run build
 *   4. Run the read-only smoke checks in docs/mainnet-deployment.md.
 *
 * Network facts (Arc Mainnet — official docs.arc.io):
 *   Chain ID : 5042
 *   RPC      : https://rpc.mainnet.arc.io
 *   Explorer : https://explorer.arc.io
 *   USDC     : 0x3600000000000000000000000000000000000000  (6 decimals, ERC-20 view)
 *   Gas token: USDC (same asset, 18-decimal native view — do NOT treat as a separate token)
 */
contract DeployVeritasMainnet is Script {
    /// @notice Arc USDC predeploy — same address on both mainnet and testnet.
    address public constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    /// @notice Arc Mainnet chain ID — verified from https://docs.arc.io
    uint256 public constant ARC_MAINNET_CHAIN_ID = 5042;

    function run() external returns (VeritasEscrow escrow) {
        // Abort if accidentally pointed at the wrong chain.
        require(
            block.chainid == ARC_MAINNET_CHAIN_ID,
            string.concat(
                "DeployVeritasMainnet: wrong chain. Expected Arc Mainnet (5042), got chain ID ",
                vm.toString(block.chainid),
                ". Pass --rpc-url https://rpc.mainnet.arc.io to target the correct network."
            )
        );

        console.log("=== VERITAS Mainnet Deployment ===");
        console.log("Chain ID       :", block.chainid);
        console.log("Deployer       :", msg.sender);
        console.log("USDC address   :", ARC_USDC);
        console.log("Block number   :", block.number);
        console.log("Block timestamp:", block.timestamp);

        vm.startBroadcast();

        escrow = new VeritasEscrow(ARC_USDC);

        vm.stopBroadcast();

        console.log("=== Deployment Complete ===");
        console.log("VeritasEscrow  :", address(escrow));
        console.log("Explorer       :", string.concat("https://explorer.arc.io/address/", vm.toString(address(escrow))));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Add to .env: VITE_ESCROW_ADDRESS_MAINNET=", vm.toString(address(escrow)));
        console.log("  2. Verify USDC token: cast call", vm.toString(address(escrow)), "\"getUsdcToken()(address)\" --rpc-url https://rpc.mainnet.arc.io");
        console.log("  3. Verify bountyCount: cast call", vm.toString(address(escrow)), "\"bountyCount()(uint256)\" --rpc-url https://rpc.mainnet.arc.io");
        console.log("  4. Rebuild frontend: bun run build");

        // Sanity-check the deployment in the same transaction context.
        require(address(escrow) != address(0), "Deploy returned zero address");
        require(escrow.getUsdcToken() == ARC_USDC, "USDC address mismatch post-deploy");
        require(escrow.bountyCount() == 0, "bountyCount should be 0 on fresh deploy");
    }
}
