// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VeritasEscrow
/// @author VERITAS
/// @notice Escrow contract for USDC-denominated bounties with a single-winner payout flow.
/// @dev Stores only minimal bounty metadata onchain and uses SafeERC20 for token transfers.
contract VeritasEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum BountyStatus {
        Created,
        Funded,
        Approved,
        Paid,
        Cancelled
    }

    struct Bounty {
        address owner;
        uint256 rewardAmount;
        uint256 deadline;
        BountyStatus status;
        address approvedContributor;
        bytes32 contentHash;
    }

    error NotBountyOwner();
    /// @dev current = actual status; requiredOne / requiredTwo = valid statuses (requiredTwo = 0 when only one valid state)
    error InvalidStatus(BountyStatus current, BountyStatus requiredOne, BountyStatus requiredTwo);
    error ZeroAddress();
    error ZeroAmount();
    error DeadlineInPast();
    error OwnerCannotBeContributor();
    error BountyNotFound();

    /// @notice Emitted when a new bounty is created.
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed owner,
        uint256 rewardAmount,
        uint256 deadline,
        bytes32 contentHash
    );

    /// @notice Emitted when a bounty is funded with USDC.
    event BountyFunded(uint256 indexed bountyId, address indexed owner, uint256 rewardAmount);

    /// @notice Emitted when a contributor is approved as the bounty winner.
    event ContributorApproved(uint256 indexed bountyId, address indexed contributor);

    /// @notice Emitted when bounty payment is released to the approved contributor.
    event PaymentReleased(uint256 indexed bountyId, address indexed contributor, uint256 rewardAmount);

    /// @notice Emitted when a bounty is cancelled and funds are refunded to the owner.
    event BountyCancelled(uint256 indexed bountyId, address indexed owner, uint256 rewardAmount);

    mapping(uint256 => Bounty) public bounties;
    uint256 public bountyCount;

    IERC20 private immutable usdcToken;

    /// @notice Sets the ERC-20 token used for bounty escrow.
    /// @param usdcToken_ The USDC token contract address.
    constructor(address usdcToken_) {
        if (usdcToken_ == address(0)) revert ZeroAddress();
        usdcToken = IERC20(usdcToken_);
    }

    /// @notice Creates a new bounty in Created state.
    /// @param contentHash keccak256 hash of offchain bounty content.
    /// @param rewardAmount The exact USDC reward amount (token decimals are defined by the token).
    /// @param deadline The UNIX timestamp after which work is considered expired offchain.
    /// @return bountyId The newly created bounty ID.
    function createBounty(
        bytes32 contentHash,
        uint256 rewardAmount,
        uint256 deadline
    ) external returns (uint256 bountyId) {
        if (rewardAmount == 0) revert ZeroAmount();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        bountyId = ++bountyCount;

        bounties[bountyId] = Bounty({
            owner: msg.sender,
            rewardAmount: rewardAmount,
            deadline: deadline,
            status: BountyStatus.Created,
            approvedContributor: address(0),
            contentHash: contentHash
        });

        emit BountyCreated(bountyId, msg.sender, rewardAmount, deadline, contentHash);
    }

    /// @notice Funds an existing bounty by transferring its exact reward amount from owner to this contract.
    /// @param bountyId The bounty ID to fund.
    function fundBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _getExistingBounty(bountyId);
        _onlyBountyOwner(bounty.owner);

        if (bounty.status != BountyStatus.Created) {
            revert InvalidStatus(bounty.status, BountyStatus.Created, BountyStatus.Created);
        }

        bounty.status = BountyStatus.Funded;
        usdcToken.safeTransferFrom(msg.sender, address(this), bounty.rewardAmount);

        emit BountyFunded(bountyId, msg.sender, bounty.rewardAmount);
    }

    /// @notice Approves the winning contributor for a funded bounty.
    /// @param bountyId The bounty ID.
    /// @param contributor The contributor address to approve.
    function approveContributor(uint256 bountyId, address contributor) external {
        Bounty storage bounty = _getExistingBounty(bountyId);
        _onlyBountyOwner(bounty.owner);

        if (bounty.status != BountyStatus.Funded) {
            revert InvalidStatus(bounty.status, BountyStatus.Funded, BountyStatus.Funded);
        }
        if (contributor == address(0)) revert ZeroAddress();
        if (contributor == bounty.owner) revert OwnerCannotBeContributor();

        bounty.approvedContributor = contributor;
        bounty.status = BountyStatus.Approved;

        emit ContributorApproved(bountyId, contributor);
    }

    /// @notice Releases escrowed USDC to the approved contributor.
    /// @param bountyId The bounty ID.
    function releasePayment(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _getExistingBounty(bountyId);
        _onlyBountyOwner(bounty.owner);

        if (bounty.status != BountyStatus.Approved) {
            revert InvalidStatus(bounty.status, BountyStatus.Approved, BountyStatus.Approved);
        }

        address contributor = bounty.approvedContributor;

        bounty.status = BountyStatus.Paid;
        usdcToken.safeTransfer(contributor, bounty.rewardAmount);

        emit PaymentReleased(bountyId, contributor, bounty.rewardAmount);
    }

    /// @notice Cancels a funded or approved bounty and refunds escrowed USDC to the owner.
    /// @param bountyId The bounty ID.
    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _getExistingBounty(bountyId);
        _onlyBountyOwner(bounty.owner);

        BountyStatus current = bounty.status;
        if (current != BountyStatus.Funded && current != BountyStatus.Approved) {
            revert InvalidStatus(current, BountyStatus.Funded, BountyStatus.Approved);
        }

        bounty.status = BountyStatus.Cancelled;
        usdcToken.safeTransfer(bounty.owner, bounty.rewardAmount);

        emit BountyCancelled(bountyId, msg.sender, bounty.rewardAmount);
    }

    /// @notice Returns full bounty details.
    /// @param bountyId The bounty ID.
    /// @return bounty The bounty struct.
    function getBounty(uint256 bountyId) external view returns (Bounty memory bounty) {
        _requireBountyExists(bountyId);
        bounty = bounties[bountyId];
    }

    /// @notice Returns the configured USDC token address.
    /// @return token The USDC token contract address.
    function getUsdcToken() external view returns (address token) {
        token = address(usdcToken);
    }

    function _getExistingBounty(uint256 bountyId) internal view returns (Bounty storage bounty) {
        _requireBountyExists(bountyId);
        bounty = bounties[bountyId];
    }

    function _requireBountyExists(uint256 bountyId) internal view {
        if (bountyId == 0 || bountyId > bountyCount) revert BountyNotFound();
    }

    function _onlyBountyOwner(address owner) internal view {
        if (msg.sender != owner) revert NotBountyOwner();
    }
}
