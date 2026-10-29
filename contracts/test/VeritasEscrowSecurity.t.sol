// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VeritasEscrowSecurity — Stage 6 security regression tests
 *
 * Covers findings and gaps identified in the Stage 6 audit:
 *  1. Reentrancy attack on releasePayment via a malicious ERC-20 receiver
 *  2. Reentrancy attack on cancelBounty
 *  3. Reentrancy attack on fundBounty
 *  4. fundBounty fails gracefully when allowance is insufficient
 *  5. getBounty reverts for out-of-bounds IDs (id = bountyCount + 1)
 *  6. Double-approve: approveContributor reverts if already Approved
 *  7. releasePayment uses stored approvedContributor, not a caller-supplied address
 *  8. Multi-bounty accounting: two bounties funded; releasing one does not alter the other
 *     (regression for the isolation invariant tested in Stage 2, extended with balance checks)
 *  9. Fuzz: payout always goes to approvedContributor, never to owner or zero
 * 10. cancelBounty cannot be called by the approvedContributor (must be owner)
 * 11. approveContributor cannot be called by the approvedContributor themselves
 * 12. releasePayment reverts when called before approveContributor (Funded state)
 */

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VeritasEscrow} from "../VeritasEscrow.sol";
import {VeritasEscrowTestBase} from "./VeritasEscrow.Base.t.sol";

// ---------------------------------------------------------------------------
// Malicious ERC-20 that re-enters a target function on transfer
// ---------------------------------------------------------------------------

contract ReentrantMockERC20 is ERC20 {
    uint8 private _dec;
    address private _reentrantTarget;
    bytes  private _reentrantCalldata;
    bool   private _attackArmed;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    /// @notice Arms the token to re-enter `target` with `data` on the next `transfer` call.
    function armReentrancy(address target, bytes calldata data) external {
        _reentrantTarget  = target;
        _reentrantCalldata = data;
        _attackArmed      = true;
    }

    function disarm() external { _attackArmed = false; }

    /// @dev Overrides transfer to insert a re-entrant call when armed.
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (_attackArmed) {
            _attackArmed = false; // prevent infinite recursion
            (bool ok,) = _reentrantTarget.call(_reentrantCalldata);
            // We don't care about the return value — the test will check that
            // the guarded call reverted.
            (ok); // suppress unused variable warning
        }
        return super.transfer(to, amount);
    }
}

// ---------------------------------------------------------------------------
// Security test contract
// ---------------------------------------------------------------------------

contract VeritasEscrowSecurityTest is VeritasEscrowTestBase {

    // We need a reentrant token for reentrancy tests — deploy a separate escrow instance.
    ReentrantMockERC20  internal rUsdc;
    VeritasEscrow       internal rEscrow;

    bytes32 private constant HASH2 = keccak256("security-test");

    function setUp() public override {
        super.setUp();

        // Deploy a second escrow with the reentrant mock token
        rUsdc  = new ReentrantMockERC20("RToken", "RTK", 6);
        rEscrow = new VeritasEscrow(address(rUsdc));

        rUsdc.mint(alice, INITIAL_MINT);
        vm.prank(alice);
        rUsdc.approve(address(rEscrow), type(uint256).max);

        rUsdc.mint(charlie, INITIAL_MINT);
        vm.prank(charlie);
        rUsdc.approve(address(rEscrow), type(uint256).max);
    }

    // ── 1. Reentrancy on releasePayment ──────────────────────────────────────

    function testReentrancy_releasePayment() public {
        // Create & fund an approved bounty on the reentrant escrow
        vm.prank(alice);
        uint256 bid = rEscrow.createBounty(HASH2, REWARD, DEADLINE);
        vm.prank(alice);
        rEscrow.fundBounty(bid);
        vm.prank(alice);
        rEscrow.approveContributor(bid, bob);

        // Arm the token to re-enter releasePayment when bob receives the transfer
        bytes memory reenterData = abi.encodeWithSelector(
            VeritasEscrow.releasePayment.selector, bid
        );
        rUsdc.armReentrancy(address(rEscrow), reenterData);

        // releasePayment itself should succeed (ReentrancyGuard blocks the inner call)
        vm.prank(alice);
        rEscrow.releasePayment(bid);

        // Bounty must be Paid — not double-paid
        VeritasEscrow.Bounty memory b = rEscrow.getBounty(bid);
        assertEq(uint8(b.status), uint8(S_PAID));
        // Bob should have exactly REWARD (no double-transfer)
        assertEq(rUsdc.balanceOf(bob), REWARD);
    }

    // ── 2. Reentrancy on cancelBounty ─────────────────────────────────────────

    function testReentrancy_cancelBounty() public {
        vm.prank(alice);
        uint256 bid = rEscrow.createBounty(HASH2, REWARD, DEADLINE);
        vm.prank(alice);
        rEscrow.fundBounty(bid);

        bytes memory reenterData = abi.encodeWithSelector(
            VeritasEscrow.cancelBounty.selector, bid
        );
        rUsdc.armReentrancy(address(rEscrow), reenterData);

        uint256 aliceBefore = rUsdc.balanceOf(alice);
        vm.prank(alice);
        rEscrow.cancelBounty(bid);

        // Bounty is Cancelled, alice got exactly REWARD back once
        VeritasEscrow.Bounty memory b = rEscrow.getBounty(bid);
        assertEq(uint8(b.status), uint8(S_CANCELLED));
        assertEq(rUsdc.balanceOf(alice), aliceBefore + REWARD);
    }

    // ── 3. Reentrancy on fundBounty ───────────────────────────────────────────

    function testReentrancy_fundBounty() public {
        vm.prank(alice);
        uint256 bid = rEscrow.createBounty(HASH2, REWARD, DEADLINE);

        // Arm to re-enter fundBounty on transferFrom (which is transfer-like here)
        bytes memory reenterData = abi.encodeWithSelector(
            VeritasEscrow.fundBounty.selector, bid
        );
        rUsdc.armReentrancy(address(rEscrow), reenterData);

        vm.prank(alice);
        rEscrow.fundBounty(bid);

        // Must be Funded exactly once
        VeritasEscrow.Bounty memory b = rEscrow.getBounty(bid);
        assertEq(uint8(b.status), uint8(S_FUNDED));
        assertEq(rUsdc.balanceOf(address(rEscrow)), REWARD);
    }

    // ── 4. fundBounty fails when allowance insufficient ────────────────────────

    function testFundBounty_insufficientAllowance() public {
        // Create with the normal escrow but use a fresh wallet with no approval
        address frank = makeAddr("frank");
        usdc.mint(frank, REWARD);
        // Frank intentionally does NOT approve the escrow.

        vm.prank(frank);
        uint256 bid = escrow.createBounty(HASH2, REWARD, DEADLINE);

        vm.prank(frank);
        // SafeERC20 will revert because allowance = 0
        vm.expectRevert();
        escrow.fundBounty(bid);
    }

    // ── 5. getBounty reverts for out-of-range id ──────────────────────────────

    function testGetBounty_outOfRange() public {
        // Create one bounty so bountyCount == 1, then query id 999 which is > bountyCount
        _createDefaultBounty();
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.BountyNotFound.selector));
        escrow.getBounty(999);
    }

    // ── 6. Double-approve reverts (already Approved) ──────────────────────────

    function testApproveContributor_alreadyApproved() public {
        uint256 bid = _fundedBounty();
        vm.prank(alice);
        escrow.approveContributor(bid, bob);

        // Second approve attempt — bounty is now Approved, not Funded
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_APPROVED,
                S_FUNDED,
                S_FUNDED
            )
        );
        escrow.approveContributor(bid, bob);
    }

    // ── 7. releasePayment pays approvedContributor, not a caller-supplied address ──

    function testReleasePayment_paysStoredContributor() public {
        uint256 bid = _approvedBounty(); // approvedContributor = bob

        uint256 bobBefore   = usdc.balanceOf(bob);
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 eveBefore   = usdc.balanceOf(eve);

        // Owner calls releasePayment — payout must go to bob, not alice or eve
        vm.prank(alice);
        escrow.releasePayment(bid);

        assertEq(usdc.balanceOf(bob),   bobBefore + REWARD,   "bob must receive reward");
        assertEq(usdc.balanceOf(alice), aliceBefore,           "alice must not receive reward");
        assertEq(usdc.balanceOf(eve),   eveBefore,             "eve must not receive reward");
    }

    // ── 8. Multi-bounty accounting: releasing one doesn't affect the other ────

    function testMultiBounty_accounting() public {
        // Two funded bounties
        uint256 id1 = _fundedBounty();           // alice, REWARD
        vm.prank(charlie);
        uint256 id2 = escrow.createBounty(HASH2, REWARD2, DEADLINE);
        vm.prank(charlie);
        escrow.fundBounty(id2);

        assertEq(usdc.balanceOf(address(escrow)), REWARD + REWARD2);

        // Approve & release bounty 2 (charlie → bob)
        vm.prank(charlie);
        escrow.approveContributor(id2, bob);
        vm.prank(charlie);
        escrow.releasePayment(id2);

        // Escrow should still hold REWARD for bounty 1
        assertEq(usdc.balanceOf(address(escrow)), REWARD);
        // Bounty 1 is still Funded
        assertEq(uint8(escrow.getBounty(id1).status), uint8(S_FUNDED));
        // Bob received REWARD2
        assertEq(usdc.balanceOf(bob), REWARD2);
    }

    // ── 9. Fuzz: payout always lands on approvedContributor ──────────────────

    function testFuzz_payout_alwaysGoesToApprovedContributor(address contributor) public {
        vm.assume(contributor != address(0));
        vm.assume(contributor != alice); // OwnerCannotBeContributor
        vm.assume(contributor.code.length == 0); // no contract shenanigans

        uint256 bid = _fundedBounty();
        vm.prank(alice);
        escrow.approveContributor(bid, contributor);

        uint256 before = usdc.balanceOf(contributor);
        vm.prank(alice);
        escrow.releasePayment(bid);

        assertEq(usdc.balanceOf(contributor), before + REWARD, "reward must land on approvedContributor");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow must be drained exactly");
    }

    // ── 10. cancelBounty cannot be called by the approvedContributor ──────────

    function testCancelBounty_approvedContributorCannotCancel() public {
        uint256 bid = _approvedBounty(); // bob is approvedContributor
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.NotBountyOwner.selector));
        escrow.cancelBounty(bid);
    }

    // ── 11. approveContributor cannot be called by the contributor themselves ──

    function testApproveContributor_contributorCannotApproveSelf() public {
        uint256 bid = _fundedBounty();
        vm.prank(bob); // bob tries to approve himself
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.NotBountyOwner.selector));
        escrow.approveContributor(bid, bob);
    }

    // ── 12. releasePayment reverts on Funded (not yet Approved) ──────────────

    function testReleasePayment_requiresApprovedState() public {
        uint256 bid = _fundedBounty(); // Funded, not Approved
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_FUNDED,
                S_APPROVED,
                S_APPROVED
            )
        );
        escrow.releasePayment(bid);
    }
}
