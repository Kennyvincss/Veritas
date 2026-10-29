// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {VeritasEscrowTestBase} from "./VeritasEscrow.Base.t.sol";
import {VeritasEscrow} from "../VeritasEscrow.sol";

contract VeritasEscrowTest is VeritasEscrowTestBase {

    // =========================================================================
    // 1. Constructor
    // =========================================================================

    /// @notice constructor reverts on zero-address token.
    function testConstructor_zeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.ZeroAddress.selector));
        new VeritasEscrow(address(0));
    }

    /// @notice constructor stores token address correctly.
    function testConstructor_storesToken() public view {
        assertEq(escrow.getUsdcToken(), address(usdc));
        assertEq(escrow.bountyCount(), 0);
    }

    // =========================================================================
    // 2. createBounty
    // =========================================================================

    /// @notice Test 1 — creates bounty, verifies state and emits BountyCreated.
    function testCreateBounty_success() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit VeritasEscrow.BountyCreated(1, alice, REWARD, DEADLINE, CONTENT_HASH);
        uint256 bountyId = escrow.createBounty(CONTENT_HASH, REWARD, DEADLINE);

        assertEq(bountyId, 1);
        assertEq(escrow.bountyCount(), 1);

        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(b.owner,               alice);
        assertEq(b.rewardAmount,        REWARD);
        assertEq(b.deadline,            DEADLINE);
        assertEq(uint8(b.status),       uint8(S_CREATED));
        assertEq(b.approvedContributor, address(0));
        assertEq(b.contentHash,         CONTENT_HASH);
    }

    /// @notice Test 2 — reverts ZeroAmount when rewardAmount == 0.
    function testCreateBounty_zeroReward() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.ZeroAmount.selector));
        escrow.createBounty(CONTENT_HASH, 0, DEADLINE);
    }

    /// @notice Test 3 — reverts DeadlineInPast when deadline == block.timestamp.
    function testCreateBounty_deadlineEqualTimestamp() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.DeadlineInPast.selector));
        escrow.createBounty(CONTENT_HASH, REWARD, block.timestamp);
    }

    /// @notice Test 3b — reverts DeadlineInPast when deadline < block.timestamp.
    function testCreateBounty_deadlineInPast() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.DeadlineInPast.selector));
        escrow.createBounty(CONTENT_HASH, REWARD, block.timestamp - 1);
    }

    // =========================================================================
    // 3. fundBounty
    // =========================================================================

    /// @notice Test 4 — fund bounty; verifies escrow balance, status, emits BountyFunded.
    function testFundBounty_success() public {
        uint256 bountyId = _createDefaultBounty();

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit VeritasEscrow.BountyFunded(bountyId, alice, REWARD);
        escrow.fundBounty(bountyId);

        assertEq(usdc.balanceOf(address(escrow)), REWARD);
        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(uint8(b.status), uint8(S_FUNDED));
    }

    /// @notice Test 5 — non-owner cannot fund, reverts NotBountyOwner.
    function testFundBounty_notOwner() public {
        uint256 bountyId = _createDefaultBounty();
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.NotBountyOwner.selector));
        escrow.fundBounty(bountyId);
    }

    /// @notice Test 6 — funding twice reverts InvalidStatus (Funded, requires Created).
    function testFundBounty_alreadyFunded() public {
        uint256 bountyId = _fundedBounty();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_FUNDED,
                S_CREATED,
                S_CREATED
            )
        );
        escrow.fundBounty(bountyId);
    }

    // =========================================================================
    // 4. approveContributor
    // =========================================================================

    /// @notice Test 7 — fund then approve; verifies approvedContributor, status, event.
    function testApproveContributor_success() public {
        uint256 bountyId = _fundedBounty();

        vm.prank(alice);
        vm.expectEmit(true, true, false, false, address(escrow));
        emit VeritasEscrow.ContributorApproved(bountyId, bob);
        escrow.approveContributor(bountyId, bob);

        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(b.approvedContributor, bob);
        assertEq(uint8(b.status), uint8(S_APPROVED));
    }

    /// @notice Test 8 — non-owner cannot approve, reverts NotBountyOwner.
    function testApproveContributor_notOwner() public {
        uint256 bountyId = _fundedBounty();
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.NotBountyOwner.selector));
        escrow.approveContributor(bountyId, bob);
    }

    /// @notice Test 9 — zero address contributor reverts ZeroAddress.
    function testApproveContributor_zeroAddress() public {
        uint256 bountyId = _fundedBounty();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.ZeroAddress.selector));
        escrow.approveContributor(bountyId, address(0));
    }

    /// @notice Test 10 — owner as contributor reverts OwnerCannotBeContributor.
    function testApproveContributor_ownerIsContributor() public {
        uint256 bountyId = _fundedBounty();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.OwnerCannotBeContributor.selector));
        escrow.approveContributor(bountyId, alice);
    }

    /// @notice Test 11 — approve on Created bounty reverts InvalidStatus.
    function testApproveContributor_wrongStatus() public {
        uint256 bountyId = _createDefaultBounty(); // still Created
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_CREATED,
                S_FUNDED,
                S_FUNDED
            )
        );
        escrow.approveContributor(bountyId, bob);
    }

    // =========================================================================
    // 5. releasePayment
    // =========================================================================

    /// @notice Test 12 — full happy path: create→fund→approve→release.
    function testReleasePayment_success() public {
        uint256 bountyId = _approvedBounty();
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit VeritasEscrow.PaymentReleased(bountyId, bob, REWARD);
        escrow.releasePayment(bountyId);

        assertEq(usdc.balanceOf(bob),             bobBefore + REWARD);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(uint8(b.status), uint8(S_PAID));
    }

    /// @notice Test 13 — non-owner cannot release, reverts NotBountyOwner.
    function testReleasePayment_notOwner() public {
        uint256 bountyId = _approvedBounty();
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.NotBountyOwner.selector));
        escrow.releasePayment(bountyId);
    }

    /// @notice Test 14 — release on Funded (not Approved) bounty reverts InvalidStatus.
    function testReleasePayment_wrongStatus() public {
        uint256 bountyId = _fundedBounty(); // Funded, not Approved
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_FUNDED,
                S_APPROVED,
                S_APPROVED
            )
        );
        escrow.releasePayment(bountyId);
    }

    /// @notice Test 15 — calling releasePayment twice reverts on second call (status Paid).
    function testReleasePayment_noDuplicate() public {
        uint256 bountyId = _approvedBounty();

        vm.prank(alice);
        escrow.releasePayment(bountyId);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_PAID,
                S_APPROVED,
                S_APPROVED
            )
        );
        escrow.releasePayment(bountyId);
    }

    // =========================================================================
    // 6. cancelBounty
    // =========================================================================

    /// @notice Test 16 — cancel from Funded; owner receives refund, status Cancelled, event.
    function testCancelBounty_fromFunded() public {
        uint256 bountyId  = _fundedBounty();
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit VeritasEscrow.BountyCancelled(bountyId, alice, REWARD);
        escrow.cancelBounty(bountyId);

        assertEq(usdc.balanceOf(alice),           aliceBefore + REWARD);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(uint8(b.status), uint8(S_CANCELLED));
    }

    /// @notice Test 17 — cancel from Approved; owner receives refund.
    function testCancelBounty_fromApproved() public {
        uint256 bountyId    = _approvedBounty();
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        escrow.cancelBounty(bountyId);

        assertEq(usdc.balanceOf(alice), aliceBefore + REWARD);
        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(uint8(b.status), uint8(S_CANCELLED));
    }

    /// @notice Test 18 — non-owner cannot cancel, reverts NotBountyOwner.
    function testCancelBounty_notOwner() public {
        uint256 bountyId = _fundedBounty();
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.NotBountyOwner.selector));
        escrow.cancelBounty(bountyId);
    }

    /// @notice Test 19 — cannot cancel a Paid bounty, reverts InvalidStatus.
    function testCancelBounty_afterPaid() public {
        uint256 bountyId = _approvedBounty();
        vm.prank(alice);
        escrow.releasePayment(bountyId);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_PAID,
                S_FUNDED,
                S_APPROVED
            )
        );
        escrow.cancelBounty(bountyId);
    }

    /// @notice Test 20 — cannot cancel a Created (unfunded) bounty, reverts InvalidStatus.
    function testCancelBounty_fromCreated() public {
        uint256 bountyId = _createDefaultBounty(); // Created, never funded
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_CREATED,
                S_FUNDED,
                S_APPROVED
            )
        );
        escrow.cancelBounty(bountyId);
    }

    // =========================================================================
    // 7. Edge / integration
    // =========================================================================

    /// @notice Test 21 — releasePayment on Created bounty reverts.
    function testCannotPayBeforeFunding() public {
        uint256 bountyId = _createDefaultBounty();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeritasEscrow.InvalidStatus.selector,
                S_CREATED,
                S_APPROVED,
                S_APPROVED
            )
        );
        escrow.releasePayment(bountyId);
    }

    /// @notice Test 22 — two bounties with different owners; fund+release one; other unaffected.
    function testBountyIsolation() public {
        // Bounty 1: alice, REWARD
        uint256 id1 = _createDefaultBounty();

        // Bounty 2: charlie, REWARD2
        vm.prank(charlie);
        uint256 id2 = escrow.createBounty(CONTENT_HASH, REWARD2, DEADLINE);

        // Fund both
        vm.prank(alice);
        escrow.fundBounty(id1);

        vm.prank(charlie);
        escrow.fundBounty(id2);

        assertEq(usdc.balanceOf(address(escrow)), REWARD + REWARD2);

        // Approve & release bounty 1 only
        vm.prank(alice);
        escrow.approveContributor(id1, bob);

        vm.prank(alice);
        escrow.releasePayment(id1);

        // Bounty 2 is untouched
        assertEq(usdc.balanceOf(address(escrow)), REWARD2);
        VeritasEscrow.Bounty memory b2 = escrow.getBounty(id2);
        assertEq(uint8(b2.status), uint8(S_FUNDED));
        assertEq(b2.rewardAmount, REWARD2);
    }

    /// @notice Test 23 — getBounty reverts BountyNotFound for id=0 and id=99.
    function testGetBounty_notFound() public {
        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.BountyNotFound.selector));
        escrow.getBounty(0);

        vm.expectRevert(abi.encodeWithSelector(VeritasEscrow.BountyNotFound.selector));
        escrow.getBounty(99);
    }

    // =========================================================================
    // 8. Fuzz
    // =========================================================================

    /// @notice Test 25 — fuzz over reward and deadline; verify bounty created correctly.
    function testFuzz_createBounty_rewardAndDeadline(uint256 reward, uint256 deadline) public {
        reward   = bound(reward,   1,                    1e12 * 1e6);
        deadline = bound(deadline, block.timestamp + 1,  block.timestamp + 365 days);

        // Ensure alice has enough tokens and approval for any fuzz value.
        usdc.mint(alice, reward);
        // approve was set to max in setUp, nothing more needed.

        vm.prank(alice);
        uint256 bountyId = escrow.createBounty(CONTENT_HASH, reward, deadline);

        assertEq(escrow.bountyCount(), bountyId);

        VeritasEscrow.Bounty memory b = escrow.getBounty(bountyId);
        assertEq(b.rewardAmount, reward);
        assertEq(b.deadline,     deadline);
        assertEq(uint8(b.status), uint8(S_CREATED));
        assertEq(b.owner, alice);
    }
}
