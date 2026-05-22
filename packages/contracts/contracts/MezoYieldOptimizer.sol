// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGaugeController} from "./interfaces/IGaugeController.sol";
import {IMatchbox} from "./interfaces/IMatchbox.sol";

/**
 * @title MezoYieldOptimizer
 * @notice Non-custodial vote-delegation hub for veMEZO holders. Users opt
 *         into delegation, optionally pin a manual gauge allocation, and a
 *         keeper submits the optimal allocation each epoch on their behalf.
 *         The contract holds no balances and never moves user funds —
 *         claimRewards forwards directly to the Matchbox bribe market and
 *         emits a receipt event so the frontend can update.
 *
 *         BDD source of truth: `context/docs/stories/story-003.md`.
 */
contract MezoYieldOptimizer {
    /// @notice Total weight units in basis points. Allocations must sum to this.
    uint256 public constant TOTAL_BPS = 10_000;

    /// @notice Gauge controller that records vote weights.
    address public immutable gaugeController;

    /// @notice Bribe/reward market the contract forwards `claimRewards` to.
    address public immutable matchbox;

    /// @notice Address authorized to call `castOptimalVote`. Set at deploy
    ///         and rotatable by the owner. Owner is also implicitly a keeper.
    address public keeper;

    /// @notice Owner of the optimizer (deployer at construction). Can rotate
    ///         the keeper. Not a multisig in this MVP — STORY-005+ may add one.
    address public owner;

    struct Allocation {
        address[] gauges;
        uint256[] weights;
    }

    /// @notice Whether a user has opted in to delegation.
    mapping(address user => bool delegated) public isDelegated;

    /// @dev User-pinned allocations (manual override). Empty when unset.
    mapping(address user => Allocation) private _allocations;

    /// @dev Enumerable list of delegated users. `castOptimalVote` iterates
    ///      this to fan out per-user votes through the adapter. Append-only
    ///      in v1 — `delegate()` pushes on first activation; subsequent
    ///      calls are no-ops. An `undelegate()` path would compact this
    ///      array (swap-and-pop) but is intentionally out of scope for now
    ///      (users who stop participating naturally fail at the adapter
    ///      level via the per-user `try`/`catch` and are silently skipped).
    address[] private _delegatedUsers;

    event Delegated(address indexed user);
    event ManualAllocationSet(address indexed user, address[] gauges, uint256[] weights);
    /// @notice Emitted once per `castOptimalVote` call, regardless of how
    ///         many users were iterated. Signature retained from v1 so the
    ///         frontend's `useLastVote` topic filter and the keeper's
    ///         per-epoch dedup walker work against this Optimizer without
    ///         ABI changes. Per-user failures surface via `VoteSkipped`.
    event VoteCast(address[] gauges, uint256[] weights);
    /// @notice Emitted for each delegated user whose forwarded
    ///         `adapter.voteForUser` reverted (e.g. they revoked NFT
    ///         approval, transferred their NFT, or already voted with
    ///         that NFT in the current BoostVoter epoch). One keeper
    ///         tick may fire 0..N of these.
    event VoteSkipped(address indexed user, bytes reason);
    event KeeperUpdated(address indexed previousKeeper, address indexed newKeeper);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardsClaimed(address indexed user, uint256 amount);

    error LengthMismatch();
    error EmptyAllocation();
    error ZeroAddress();
    error CallerMustMatchUser();

    modifier onlyKeeper() {
        // Owner is implicitly a keeper so deployments don't deadlock if the
        // dedicated keeper EOA is offline at submission time.
        require(msg.sender == keeper || msg.sender == owner, "not authorized");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /**
     * @param _gaugeController Address of the gauge controller to forward votes to.
     * @param _matchbox Address of the Matchbox bribe market.
     * @param _keeper Initial keeper allowed to call `castOptimalVote`.
     */
    constructor(address _gaugeController, address _matchbox, address _keeper) {
        if (_gaugeController == address(0) || _matchbox == address(0) || _keeper == address(0)) {
            revert ZeroAddress();
        }
        gaugeController = _gaugeController;
        matchbox = _matchbox;
        keeper = _keeper;
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
        emit KeeperUpdated(address(0), _keeper);
    }

    /**
     * @notice Opt a user into managed voting.
     * @param user The address being delegated. Must equal `msg.sender` —
     *             a user can only opt themselves in. Carrying the
     *             parameter (rather than implicit `msg.sender`) keeps the
     *             ABI aligned with `context/docs/stories/story-003.md`
     *             and `context/docs/architecture.md`, so callers encoding
     *             `delegate(address)` hit the right selector.
     */
    function delegate(address user) external {
        if (user != msg.sender) revert CallerMustMatchUser();
        // Idempotent: only push + emit on first activation. A user can
        // call delegate() repeatedly (e.g. confirming after wallet
        // reconnect) without polluting the enumerable list or spamming
        // the event log.
        if (!isDelegated[user]) {
            isDelegated[user] = true;
            _delegatedUsers.push(user);
            emit Delegated(user);
        }
    }

    /**
     * @notice Pin a manual gauge allocation for the caller.
     * @dev Weights must sum to TOTAL_BPS (10_000). Empty arrays revert.
     */
    function setManualAllocation(address[] calldata gauges, uint256[] calldata weights) external {
        _checkWeights(gauges, weights);
        _allocations[msg.sender] = Allocation(gauges, weights);
        emit ManualAllocationSet(msg.sender, gauges, weights);
    }

    /**
     * @notice Submit the optimized allocation on behalf of every delegated user.
     * @dev Keeper- (or owner-) only. Fans out one keeper transaction into N
     *      adapter calls, one per delegated user, using each user's own
     *      veMEZO NFT as the voting source. The Optimizer is non-custodial
     *      and holds no NFTs of its own — `BoostVoterAdapter.voteForUser`
     *      reads each `voter`'s first NFT (token-of-owner-by-index 0) and
     *      calls `BoostVoter.vote(tokenId, gauges, weights)` against it.
     *
     *      Each per-user adapter call is wrapped in `try`/`catch` so one
     *      stale delegation (NFT transferred, approval revoked, already
     *      voted with that NFT this epoch) does not halt the rest of the
     *      iteration. Failed users surface a `VoteSkipped(user, reason)`
     *      event; the rest still vote.
     *
     *      Gas: linear in `_delegatedUsers.length`. Hackathon scale is
     *      fine; at scale a `castOptimalVoteFor(address[] subset)`
     *      overload would let the keeper page through users across
     *      multiple txs. Out of scope for v1.
     */
    function castOptimalVote(address[] calldata gauges, uint256[] calldata weights) external onlyKeeper {
        _checkWeights(gauges, weights);
        uint256 n = _delegatedUsers.length;
        for (uint256 i; i < n; ++i) {
            address voter = _delegatedUsers[i];
            try IGaugeController(gaugeController).voteForUser(voter, gauges, weights) {
                // success — VoteCast summary event fires once at the end
            } catch (bytes memory reason) {
                emit VoteSkipped(voter, reason);
            }
        }
        emit VoteCast(gauges, weights);
    }

    /**
     * @notice Forward a claim to Matchbox on behalf of `user`. Anyone can
     *         trigger a claim FOR a user — Matchbox is responsible for
     *         routing the proceeds to the user's address. Returns the
     *         amount claimed so callers (frontend via `useSimulateContract`)
     *         can read pending without a separate view call.
     */
    function claimRewards(address user) external returns (uint256 amount) {
        amount = IMatchbox(matchbox).claim(user);
        emit RewardsClaimed(user, amount);
    }

    /// @notice Read the active allocation for a user (gauges, weights).
    function getAllocation(address user) external view returns (address[] memory, uint256[] memory) {
        Allocation storage a = _allocations[user];
        return (a.gauges, a.weights);
    }

    /// @notice Full list of delegated users (append-only in v1). Used by
    ///         the dApp to render "N users delegated" and by the keeper /
    ///         verify scripts to confirm fan-out targets on-chain.
    function delegatedUsers() external view returns (address[] memory) {
        return _delegatedUsers;
    }

    /// @notice Cheap size handle for pagination + UI counts.
    function delegatedUsersCount() external view returns (uint256) {
        return _delegatedUsers.length;
    }

    /// @notice Owner can rotate the keeper role.
    function setKeeper(address newKeeper) external onlyOwner {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Owner can transfer ownership. New owner must be non-zero.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Validate (gauges, weights) parallel arrays:
     *      - same length
     *      - non-empty
     *      - sum to TOTAL_BPS
     *      Uses the BDD-spec'd revert string `"weights must sum to 10000"`.
     */
    function _checkWeights(address[] calldata gauges, uint256[] calldata weights) private pure {
        if (gauges.length != weights.length) revert LengthMismatch();
        if (gauges.length == 0) revert EmptyAllocation();
        uint256 total;
        for (uint256 i; i < weights.length; ++i) {
            total += weights[i];
        }
        require(total == TOTAL_BPS, "weights must sum to 10000");
    }
}
