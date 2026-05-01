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
 *         addresses (`context/CONTEXT.md` open question #6); see
 *         `TESTNET_ADDRESSES.md` for the disclosure.
 *
 *         This mock records the most-recent vote so tests can assert it.
 */
contract MockGaugeController is IGaugeController {
    address[] public lastVoteGauges;
    uint256[] public lastVoteWeights;
    address public lastVoter;
    uint256 public voteCount;

    event MockVoteRecorded(address indexed voter, address[] gauges, uint256[] weights);

    function voteForGaugeWeights(address[] calldata gauges, uint256[] calldata weights) external override {
        delete lastVoteGauges;
        delete lastVoteWeights;
        for (uint256 i; i < gauges.length; ++i) {
            lastVoteGauges.push(gauges[i]);
            lastVoteWeights.push(weights[i]);
        }
        lastVoter = msg.sender;
        ++voteCount;
        emit MockVoteRecorded(msg.sender, gauges, weights);
    }

    function getLastVote() external view returns (address[] memory, uint256[] memory) {
        return (lastVoteGauges, lastVoteWeights);
    }
}
