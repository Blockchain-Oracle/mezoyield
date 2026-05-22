// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGaugeController} from "../interfaces/IGaugeController.sol";

/**
 * @title MockGaugeController
 * @notice Test/testnet stand-in for the real Mezo gauge controller. Real
 *         Mezo gauges live in `mezo-org/tigris`'s Voter.sol — see
 *         `context/refs/repos/tigris/solidity/contracts/Voter.sol`. We
 *         deploy this mock alongside MezoYieldOptimizer for testnet demos
 *         because Mezo hasn't published canonical gauge controller
 *         addresses (`context/CONTEXT.md` open question #6); see the
 *         `notes` field in `deployments/mezo-testnet.json` and
 *         `TESTNET_ADDRESSES.md` for the disclosure.
 *
 *         STORY-005 surface: in addition to the IGaugeController vote
 *         recording behavior, this mock now exposes a registry of named
 *         gauges with their total veMEZO weight. The deploy script seeds
 *         a handful of realistic gauges so the Dashboard's GaugeBoard can
 *         render against real on-chain state via wagmi `useReadContracts`
 *         when no Goldsky subgraph endpoint is configured.
 *
 *         Gauge addresses are derived deterministically from the gauge
 *         name (keccak256 of the bytes, truncated to 160 bits). This
 *         avoids deploying a separate `MockGauge` contract per gauge
 *         while still producing distinct, audit-traceable addresses.
 */
contract MockGaugeController is IGaugeController {
    // -------- Vote recording (unchanged from STORY-003) --------

    address[] public lastVoteGauges;
    uint256[] public lastVoteWeights;
    address public lastVoter;
    uint256 public voteCount;

    /// @dev Test-only revert toggle. When `shouldRevertFor[voter]` is true,
    ///      `voteForUser` reverts with the recorded reason — letting the
    ///      Optimizer's `castOptimalVote` exercise its per-user try/catch
    ///      without needing a separate dedicated mock contract.
    mapping(address => bool) public shouldRevertFor;

    event MockVoteRecorded(address indexed voter, address[] gauges, uint256[] weights);

    function setShouldRevertFor(address voter, bool revert_) external {
        shouldRevertFor[voter] = revert_;
    }

    function voteForGaugeWeights(address[] calldata gauges_, uint256[] calldata weights) external override {
        _recordVote(msg.sender, gauges_, weights);
    }

    /// @inheritdoc IGaugeController
    /// @dev Testnet stand-in: there's no real veMEZO check, so we just
    ///      record the explicit `voter` argument as the recorded voter.
    ///      The real `BoostVoterAdapter.voteForUser` enforces both the
    ///      caller (optimizer) and the voter (veMEZO holder).
    function voteForUser(
        address voter,
        address[] calldata gauges_,
        uint256[] calldata weights
    ) external override {
        if (shouldRevertFor[voter]) revert("forced revert for testing");
        _recordVote(voter, gauges_, weights);
    }

    function _recordVote(
        address voter,
        address[] calldata gauges_,
        uint256[] calldata weights
    ) private {
        delete lastVoteGauges;
        delete lastVoteWeights;
        for (uint256 i; i < gauges_.length; ++i) {
            lastVoteGauges.push(gauges_[i]);
            lastVoteWeights.push(weights[i]);
        }
        lastVoter = voter;
        ++voteCount;
        emit MockVoteRecorded(voter, gauges_, weights);
    }

    function getLastVote() external view returns (address[] memory, uint256[] memory) {
        return (lastVoteGauges, lastVoteWeights);
    }

    // -------- Gauge registry (STORY-005) --------

    struct GaugeMeta {
        string name;
        uint256 totalVeMezo;
    }

    address[] private _gaugeList;
    mapping(address gauge => GaugeMeta meta) private _meta;
    mapping(address gauge => bool registered) private _registered;

    event MockGaugeRegistered(address indexed gauge, string name, uint256 totalVeMezo);

    /**
     * @notice Register or update a gauge in the mock registry.
     * @dev Address is deterministic from the name. Idempotent — re-calling
     *      with the same name updates `totalVeMezo` without duplicating
     *      the entry in `_gaugeList`. Returns the deterministic address so
     *      the deploy script can capture it.
     */
    function addGauge(string calldata name, uint256 totalVeMezo) external returns (address gauge) {
        gauge = gaugeAddressFor(name);
        if (!_registered[gauge]) {
            _gaugeList.push(gauge);
            _registered[gauge] = true;
        }
        _meta[gauge] = GaugeMeta({name: name, totalVeMezo: totalVeMezo});
        emit MockGaugeRegistered(gauge, name, totalVeMezo);
    }

    /// @notice Deterministic gauge address for a given name. Pure helper.
    function gaugeAddressFor(string memory name) public pure returns (address) {
        return address(uint160(uint256(keccak256(bytes(name)))));
    }

    /// @notice All registered gauge addresses, in registration order.
    function gauges() external view returns (address[] memory) {
        return _gaugeList;
    }

    /// @notice Number of registered gauges. Cheap pagination handle.
    function gaugeCount() external view returns (uint256) {
        return _gaugeList.length;
    }

    /// @notice Read a gauge's metadata in one call.
    function gaugeMeta(address gauge) external view returns (string memory name, uint256 totalVeMezo) {
        GaugeMeta storage m = _meta[gauge];
        return (m.name, m.totalVeMezo);
    }
}
