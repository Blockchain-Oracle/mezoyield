// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMezoBoostVoter} from "../interfaces/external/IMezoBoostVoter.sol";

/**
 * @title MockMezoBoostVoter — test fixture for the BoostVoterAdapter.
 * @notice Records the most recent `vote(tokenId, gauges, weights)` call
 *         and the most recent `claimBribes(...)` call so unit tests can
 *         assert the adapter forwards correctly. Stores a mock
 *         `gaugeToBribe` map and `isGauge` set for the MatchboxAdapter
 *         tests.
 *
 *         Not deployed on mainnet — exists only under `test/`.
 */
contract MockMezoBoostVoter is IMezoBoostVoter {
    // Last `vote(...)` call:
    uint256 public lastVoteTokenId;
    address[] public lastVoteGauges;
    uint256[] public lastVoteWeights;
    uint256 public voteCallCount;

    // Last `claimBribes(...)` call:
    address[] public lastClaimBribes;
    uint256 public lastClaimTokenId;
    uint256 public claimCallCount;

    mapping(address => address) public bribes;
    mapping(address => bool) public registered;
    address[] public gaugeList;

    function vote(
        uint256 tokenId,
        address[] calldata gauges,
        uint256[] calldata weights
    ) external override {
        delete lastVoteGauges;
        delete lastVoteWeights;
        for (uint256 i = 0; i < gauges.length; ++i) {
            lastVoteGauges.push(gauges[i]);
            lastVoteWeights.push(weights[i]);
        }
        lastVoteTokenId = tokenId;
        voteCallCount += 1;
    }

    function isGauge(address gauge) external view override returns (bool) {
        return registered[gauge];
    }

    function gaugeToBribe(address gauge) external view override returns (address) {
        return bribes[gauge];
    }

    function claimBribes(
        address[] calldata bribesIn,
        address[][] calldata, // tokens — unused in the assertion-only mock
        uint256 tokenId
    ) external override {
        delete lastClaimBribes;
        for (uint256 i = 0; i < bribesIn.length; ++i) {
            lastClaimBribes.push(bribesIn[i]);
        }
        lastClaimTokenId = tokenId;
        claimCallCount += 1;
    }

    function gauges(uint256 index) external view override returns (address) {
        return gaugeList[index];
    }

    function votes(uint256, address) external pure override returns (uint256) {
        return 0;
    }

    // ───── Test helpers (not part of IMezoBoostVoter) ─────

    function setBribe(address gauge, address bribe) external {
        bribes[gauge] = bribe;
        registered[gauge] = true;
    }
}
