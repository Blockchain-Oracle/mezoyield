// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IBribeVotingReward} from "../interfaces/external/IBribeVotingReward.sol";

/**
 * @title MockBribeVotingReward — per-gauge bribe contract fixture.
 * @notice Stores a (rewardToken, tokenId) → earned amount mapping so
 *         the MatchboxAdapter's `pending` aggregation can be exercised
 *         in unit tests without deploying live BoostVoter bribes.
 */
contract MockBribeVotingReward is IBribeVotingReward {
    mapping(address => mapping(uint256 => uint256)) public earnedMap;

    function earned(address rewardToken, uint256 tokenId)
        external
        view
        override
        returns (uint256)
    {
        return earnedMap[rewardToken][tokenId];
    }

    function setEarned(address rewardToken, uint256 tokenId, uint256 amount) external {
        earnedMap[rewardToken][tokenId] = amount;
    }
}
