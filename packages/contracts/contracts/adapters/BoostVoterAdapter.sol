// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGaugeController} from "../interfaces/IGaugeController.sol";
import {IMezoBoostVoter} from "../interfaces/external/IMezoBoostVoter.sol";
import {IMezoVeMEZO} from "../interfaces/external/IMezoVeMEZO.sol";

/**
 * @title BoostVoterAdapter
 * @notice Bridges MezoYieldOptimizer's address-keyed gauge surface to
 *         Mezo mainnet's tokenId-keyed BoostVoter. Two responsibilities:
 *
 *           1. WRITE — forward `voteForGaugeWeights(gauges, weights)`
 *              to `BoostVoter.vote(tokenId, gauges, weights)`, using
 *              the caller's first veMEZO NFT as the source tokenId.
 *
 *           2. READ — expose the `gauges() → address[]` and
 *              `gaugeMeta(address) → (name, totalVeMezo)` registry
 *              shape every consumer (`useGaugeData`, `useProtocolStrategyMix`,
 *              keeper's `computeOptimalAllocation`) reads. Backed by an
 *              owner-managed registry because Mezo's BoostVoter has no
 *              protocol-wide aggregate getter — only per-(tokenId,gauge)
 *              `votes(...)` which would require iterating every NFT.
 *              The owner refreshes `totalVeMezo` for each registered
 *              gauge via `updateGaugeWeight(gauge, weight)` (typically
 *              from an off-chain subgraph or the keeper bot on each
 *              epoch boundary).
 *
 * Why an owner-managed registry rather than on-chain enumeration:
 * `BoostVoter.gauges(uint256)` is array-indexed without a length getter,
 * so any caller iterating to find the count risks unbounded gas or
 * revert on out-of-bounds. The honest answer for hackathon timeline:
 * register a curated list at deploy, keep weights refreshed off-chain.
 * The `bribeForGauge` mapping is intentionally absent — claim flow
 * lives in MatchboxAdapter, not here.
 */
contract BoostVoterAdapter is IGaugeController {
    /// @notice Mezo's mainnet BoostVoter proxy. Immutable at deploy time.
    IMezoBoostVoter public immutable boostVoter;

    /// @notice Mezo's mainnet veMEZO NFT. Immutable at deploy time.
    IMezoVeMEZO public immutable veMezo;

    /// @notice Owner can register/update the gauge registry.
    address public owner;

    /// @notice MezoYieldOptimizer authorized to call `voteForUser`. Set by
    ///         the owner post-deploy (chicken-and-egg: the optimizer needs
    ///         the adapter's address at construction, so we wire the
    ///         reverse pointer afterwards). Until set, `voteForUser` is
    ///         locked.
    address public optimizer;

    struct GaugeMeta {
        string name;
        uint256 totalVeMezo;
        bool registered;
    }

    mapping(address => GaugeMeta) private _meta;
    address[] private _gaugeList;

    event GaugeRegistered(address indexed gauge, string name, uint256 totalVeMezo);
    event GaugeWeightUpdated(address indexed gauge, uint256 totalVeMezo);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event OptimizerUpdated(address indexed previousOptimizer, address indexed newOptimizer);

    error CallerHasNoVeMezo();
    error VoterHasNoVeMezo();
    error NotOwner();
    error NotOptimizer();
    error AlreadyRegistered();
    error UnknownGauge();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOptimizer() {
        if (msg.sender != optimizer) revert NotOptimizer();
        _;
    }

    constructor(IMezoBoostVoter _boostVoter, IMezoVeMEZO _veMezo) {
        boostVoter = _boostVoter;
        veMezo = _veMezo;
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    // ─── WRITE: forward votes to BoostVoter ────────────────────────

    /// @inheritdoc IGaugeController
    /// @dev `msg.sender` must own at least one veMEZO NFT. The first
    ///      token (Enumerable index 0) is used as the voting source.
    ///      Single-NFT v1 limitation — multi-NFT users vote with only
    ///      their first lock.
    function voteForGaugeWeights(
        address[] calldata gauges_,
        uint256[] calldata weights
    ) external override {
        if (veMezo.balanceOf(msg.sender) == 0) {
            revert CallerHasNoVeMezo();
        }
        uint256 tokenId = veMezo.ownerToNFTokenIdList(msg.sender, 0);
        boostVoter.vote(tokenId, gauges_, weights);
    }

    /// @inheritdoc IGaugeController
    /// @dev Restricted to the configured optimizer. The optimizer is the
    ///      only authorized caller because `voter` is passed explicitly —
    ///      letting any contract invoke this would let an attacker route
    ///      arbitrary votes through any veMEZO holder who has set
    ///      approval-for-all on this adapter. The optimizer's own
    ///      `castOptimalVote` is `onlyKeeper`, so the trust path
    ///      bottoms out at the keeper EOA.
    function voteForUser(
        address voter,
        address[] calldata gauges_,
        uint256[] calldata weights
    ) external override onlyOptimizer {
        if (veMezo.balanceOf(voter) == 0) {
            revert VoterHasNoVeMezo();
        }
        uint256 tokenId = veMezo.ownerToNFTokenIdList(voter, 0);
        boostVoter.vote(tokenId, gauges_, weights);
    }

    // ─── READ: registry surface for consumers ──────────────────────

    /// @notice All registered gauge addresses, in registration order.
    function gauges() external view returns (address[] memory) {
        return _gaugeList;
    }

    /// @notice Number of registered gauges.
    function gaugeCount() external view returns (uint256) {
        return _gaugeList.length;
    }

    /// @notice Read a gauge's metadata. Returns ("", 0) for unregistered
    ///         addresses so consumers can fall back gracefully without
    ///         a revert on every probe.
    function gaugeMeta(address gauge)
        external
        view
        returns (string memory name, uint256 totalVeMezo)
    {
        GaugeMeta storage m = _meta[gauge];
        return (m.name, m.totalVeMezo);
    }

    // ─── ADMIN: registry management ────────────────────────────────

    /// @notice Register a gauge with its display name + current weight.
    function registerGauge(address gauge, string calldata name, uint256 totalVeMezo)
        external
        onlyOwner
    {
        if (_meta[gauge].registered) revert AlreadyRegistered();
        _meta[gauge] = GaugeMeta({name: name, totalVeMezo: totalVeMezo, registered: true});
        _gaugeList.push(gauge);
        emit GaugeRegistered(gauge, name, totalVeMezo);
    }

    /// @notice Batch register helper — same as calling `registerGauge`
    ///         in a loop. Atomic; reverts if any one entry is already
    ///         registered.
    function registerGauges(
        address[] calldata gauges_,
        string[] calldata names,
        uint256[] calldata totals
    ) external onlyOwner {
        uint256 n = gauges_.length;
        require(names.length == n && totals.length == n, "length mismatch");
        for (uint256 i; i < n; ++i) {
            if (_meta[gauges_[i]].registered) revert AlreadyRegistered();
            _meta[gauges_[i]] = GaugeMeta({
                name: names[i],
                totalVeMezo: totals[i],
                registered: true
            });
            _gaugeList.push(gauges_[i]);
            emit GaugeRegistered(gauges_[i], names[i], totals[i]);
        }
    }

    /// @notice Refresh the cached total voting weight for a gauge. Called
    ///         by the keeper / an off-chain process at epoch boundaries.
    function updateGaugeWeight(address gauge, uint256 totalVeMezo) external onlyOwner {
        if (!_meta[gauge].registered) revert UnknownGauge();
        _meta[gauge].totalVeMezo = totalVeMezo;
        emit GaugeWeightUpdated(gauge, totalVeMezo);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnerTransferred(prev, newOwner);
    }

    /// @notice Wire the MezoYieldOptimizer that is allowed to call
    ///         `voteForUser`. Owner-only. The optimizer needs the adapter
    ///         address at construction, so the reverse pointer is set
    ///         post-deploy.
    function setOptimizer(address newOptimizer) external onlyOwner {
        if (newOptimizer == address(0)) revert ZeroAddress();
        address prev = optimizer;
        optimizer = newOptimizer;
        emit OptimizerUpdated(prev, newOptimizer);
    }
}
