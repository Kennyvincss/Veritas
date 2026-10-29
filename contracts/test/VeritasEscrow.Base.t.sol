// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {VeritasEscrow} from "../VeritasEscrow.sol";

/// @dev Minimal ERC-20 mock with a public mint function.
contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Shared base: actors, constants, setUp, and helper functions.
abstract contract VeritasEscrowTestBase is Test {
    // ── actors ────────────────────────────────────────────────────────────────
    address internal alice   = makeAddr("alice");   // bounty owner
    address internal bob     = makeAddr("bob");     // contributor
    address internal charlie = makeAddr("charlie"); // second bounty owner
    address internal eve     = makeAddr("eve");     // unauthorised caller

    // ── constants ─────────────────────────────────────────────────────────────
    uint256 internal constant REWARD       = 500e6;   // 500 USDC (6 dp)
    uint256 internal constant REWARD2      = 250e6;   // 250 USDC
    uint256 internal constant INITIAL_MINT = 10_000e6;
    bytes32 internal constant CONTENT_HASH = keccak256("test-content");
    uint256 internal DEADLINE; // set in setUp after warp

    // ── contracts ─────────────────────────────────────────────────────────────
    MockERC20      internal usdc;
    VeritasEscrow  internal escrow;

    // ── BountyStatus mirrors (to avoid importing the enum everywhere) ─────────
    VeritasEscrow.BountyStatus internal constant S_CREATED   = VeritasEscrow.BountyStatus.Created;
    VeritasEscrow.BountyStatus internal constant S_FUNDED    = VeritasEscrow.BountyStatus.Funded;
    VeritasEscrow.BountyStatus internal constant S_APPROVED  = VeritasEscrow.BountyStatus.Approved;
    VeritasEscrow.BountyStatus internal constant S_PAID      = VeritasEscrow.BountyStatus.Paid;
    VeritasEscrow.BountyStatus internal constant S_CANCELLED = VeritasEscrow.BountyStatus.Cancelled;

    function setUp() public virtual {
        // Pin block.timestamp to a known value so DEADLINE arithmetic is stable.
        vm.warp(1_000_000);
        DEADLINE = block.timestamp + 7 days;

        usdc   = new MockERC20("Mock USDC", "mUSDC", 6);
        escrow = new VeritasEscrow(address(usdc));

        // Seed balances and approvals.
        usdc.mint(alice,   INITIAL_MINT);
        usdc.mint(charlie, INITIAL_MINT);

        vm.prank(alice);
        usdc.approve(address(escrow), type(uint256).max);

        vm.prank(charlie);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ── helper: create a bounty as alice ─────────────────────────────────────
    function _createBounty(address owner, uint256 reward, uint256 deadline)
        internal
        returns (uint256 bountyId)
    {
        vm.prank(owner);
        bountyId = escrow.createBounty(CONTENT_HASH, reward, deadline);
    }

    function _createDefaultBounty() internal returns (uint256) {
        return _createBounty(alice, REWARD, DEADLINE);
    }

    // ── helper: create + fund ─────────────────────────────────────────────────
    function _fundedBounty() internal returns (uint256 bountyId) {
        bountyId = _createDefaultBounty();
        vm.prank(alice);
        escrow.fundBounty(bountyId);
    }

    // ── helper: create + fund + approve ──────────────────────────────────────
    function _approvedBounty() internal returns (uint256 bountyId) {
        bountyId = _fundedBounty();
        vm.prank(alice);
        escrow.approveContributor(bountyId, bob);
    }
}
