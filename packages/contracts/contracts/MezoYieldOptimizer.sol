// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGaugeController} from "./interfaces/IGaugeController.sol";
import {IMatchbox} from "./interfaces/IMatchbox.sol";

/// @dev Minimal slice of veMEZO needed for the `delegate()` eligibility
///      gate. Mainnet `VeMezoVotingPower` (ERC-20-shape shim that sums
///      voting power across a user's NFTs), testnet `MockVeMezo`
///      (ERC-20-shape mock), and the upstream real Mezo `veMEZO` ERC-721
///      (NFT count) all expose this signature — `> 0` means the user
///      has voting capacity, regardless of the underlying shape.
interface IVeMezoBalance {
    function balanceOf(address user) external view returns (uint256);
}

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

    /// @notice Gauge controller that records vote weights. All consumers
    ///         (Optimizer, frontend hooks, keeper) talk to it via the
    ///         `IGaugeController` interface — the Optimizer is chain-
    ///         agnostic. The address wired here varies by network:
    ///
    ///         - Mainnet: `BoostVoterAdapter` (wraps the real Mezo
    ///           `BoostVoter` at `external.MezoBoostVoter`). Requires
    ///           each voter to own a veMEZO NFT AND have called
    ///           `veMEZO.setApprovalForAll(adapter, true)` so the
    ///           adapter can submit votes on their behalf.
    ///         - Testnet: `MockGaugeController` (records votes in mock
    ///           storage with no NFT check). No approval needed.
    ///
    ///         See `TESTNET_ADDRESSES.md#testnet-vs-mainnet-wiring-delta`
    ///         and `test/InterfaceConformance.test.ts` (selector parity).
    address public immutable gaugeController;

    /// @notice Bribe/reward market the contract forwards `claimRewards`
    ///         to. Same shape contract: `IMatchbox` interface, different
    ///         implementation per network.
    ///
    ///         - Mainnet: `MatchboxAdapter` (multiplexes per-gauge
    ///           `BribeVotingReward` claims via the real BoostVoter).
    ///         - Testnet: `MockMatchbox` (records claims in mock storage).
    address public immutable matchbox;

    /// @notice veMEZO contract (or shim) used to gate `delegate()`. Must
    ///         expose `balanceOf(address) view returns (uint256)`. On
    ///         mainnet this points at `VeMezoVotingPower` (the shim that
    ///         sums voting power across a user's NFTs); on testnet at
    ///         `MockVeMezo` (ERC-20-shape mock). `delegate()` requires
    ///         `balanceOf(msg.sender) > 0` so an attacker cannot fill
    ///         `_delegatedUsers[]` with throwaway addresses and DoS the
    ///         keeper's per-tick iteration loop.
    address public immutable veMezo;

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
    /// @notice Emitted EVERY time the keeper calls `castOptimalVote`,
    ///         regardless of whether any per-user vote succeeded.
    ///         Distinct from `VoteCast` so consumers can pick the right
    ///         dedup signal:
    ///
    ///           - Keeper's per-epoch dedup walks `TickAttempted` —
    ///             "did I already run this epoch?" Without this, a
    ///             no-delegates or all-fail tick leaves no marker and
    ///             the next cron run re-submits in the same epoch.
    ///             Codex P1 round 3 — Phase A's "VoteCast only on
    ///             success" fix created this dedup gap; this event
    ///             closes it.
    ///           - Frontend `useLastVote` walks `VoteCast` — "show
    ///             receipts of actual successful keeper activity to
    ///             the user." A no-op tick shouldn't get a "voted Xm
    ///             ago" chip.
    event TickAttempted(uint256 timestamp, uint256 successCount, uint256 delegatedUserCount);
    event KeeperUpdated(address indexed previousKeeper, address indexed newKeeper);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event RewardsClaimed(address indexed user, uint256 amount);

    error LengthMismatch();
    error EmptyAllocation();
    error ZeroAddress();
    error CallerMustMatchUser();
    error NotEligibleToDelegate();

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
     * @param _gaugeController Address of the gauge controller adapter
     *                         (or `MockGaugeController` on testnet).
     * @param _matchbox Address of the Matchbox bribe market (or adapter).
     * @param _veMezo veMEZO balance source used to gate `delegate()`.
     *                On mainnet: `VeMezoVotingPower` shim. On testnet:
     *                `MockVeMezo`. Must expose `balanceOf(address)`.
     * @param _keeper Initial keeper allowed to call `castOptimalVote`.
     */
    constructor(
        address _gaugeController,
        address _matchbox,
        address _veMezo,
        address _keeper
    ) {
        if (
            _gaugeController == address(0) ||
            _matchbox == address(0) ||
            _veMezo == address(0) ||
            _keeper == address(0)
        ) {
            revert ZeroAddress();
        }
        gaugeController = _gaugeController;
        matchbox = _matchbox;
        veMezo = _veMezo;
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
        // Gate entry on owning at least one veMEZO unit. Without this
        // check, anyone could push throwaway addresses into the
        // enumerable list and grow keeper-tick gas linearly until the
        // batch exceeds block gas — a public DoS surface for free
        // (caller pays only the delegate() gas; keeper pays forever).
        // Codex P2 on round 1 of this PR.
        if (IVeMezoBalance(veMezo).balanceOf(msg.sender) == 0) {
            revert NotEligibleToDelegate();
        }
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
        uint256 successCount;
        for (uint256 i; i < n; ++i) {
            address voter = _delegatedUsers[i];
            try IGaugeController(gaugeController).voteForUser(voter, gauges, weights) {
                unchecked { ++successCount; }
            } catch (bytes memory reason) {
                emit VoteSkipped(voter, reason);
            }
        }
        // Always emit `TickAttempted` so the keeper's per-epoch dedup
        // has a marker even when nothing landed — without it, daily
        // cron + a no-delegates-or-all-fail tick would re-submit every
        // day until the epoch turns over (Codex P1 round 3). Only emit
        // `VoteCast` when at least one per-user vote actually landed:
        // that one is the user-facing "real vote happened" signal that
        // ProofLedger + the keeper-heartbeat chip consume.
        emit TickAttempted(block.timestamp, successCount, n);
        if (successCount > 0) {
            emit VoteCast(gauges, weights);
        }
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
