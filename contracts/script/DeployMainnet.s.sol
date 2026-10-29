// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VeritasEscrow} from "../VeritasEscrow.sol";

/// @notice Deploy VeritasEscrow to Arc Mainnet.
///
/// USAGE (run from the project root — never from inside contracts/):
///
///   1. Import your deployer key into a Foundry keystore (one-time):
///        cast wallet import veritas-deployer --interactive
///
///   2. Run the deploy (--broadcast submits the actual transaction):
///        forge script contracts/script/DeployMainnet.s.sol \
///          --rpc-url https://rpc.mainnet.arc.io \
///          --account veritas-deployer \
///          --broadcast \
///          --verify \
///          -vvvv
///
/// PREREQUISITES:
///   - Your deployer wallet must hold USDC on Arc Mainnet for gas.
///   - Arc Mainnet Chain ID is 5042.
///   - USDC predeploy address is 0x3600000000000000000000000000000000000000
///     (same on both Arc Testnet and Arc Mainnet).
///
/// AFTER DEPLOY:
///   1. Note the deployed contract address from the console output.
///   2. Add to .env:  VITE_ESCROW_ADDRESS_MAINNET=0x<deployed-address>
///   3. Rebuild and redeploy the frontend.
///
/// SECURITY NOTES:
///   - Never pass --private-key as a CLI flag in production. Use --account
///     (Foundry encrypted keystore) or another secrets manager instead.
///   - The USDC address is a known Arc predeploy. Confirm at
///     https://docs.arc.io/arc/references/contract-addresses before transacting.
///   - This contract has NOT been independently audited. Obtain a professional
///     audit before exposing it to significant mainnet value.
contract DeployMainnet is Script {
    /// @dev Arc Mainnet USDC ERC-20 predeploy address.
    ///      Same on testnet and mainnet — verified at https://docs.arc.io/arc/references/contract-addresses
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        VeritasEscrow escrow = new VeritasEscrow(USDC);

        vm.stopBroadcast();

        console.log("=== VeritasEscrow deployed to Arc Mainnet ===");
        console.log("Contract address:", address(escrow));
        console.log("USDC token:      ", USDC);
        console.log("Deployer:        ", vm.addr(deployerPrivateKey));
        console.log("");
        console.log("Next steps:");
        console.log("  1. Add to .env:  VITE_ESCROW_ADDRESS_MAINNET=", address(escrow));
        console.log("  2. Rebuild and redeploy the frontend.");
        console.log("  3. Verify the deployment at https://explorer.arc.io/address/", address(escrow));
    }
}
