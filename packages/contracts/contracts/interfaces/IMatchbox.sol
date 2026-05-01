// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMatchbox — minimal interface used by MezoYieldOptimizer
 * @notice "Matchbox" is the working name for Mezo's bribe/incentive market —
 *         per `context/CONTEXT.md` open question #6, no canonical address has
 *         been published yet. The Tigris codebase (cloned at
 *         `context/refs/repos/tigris/`) implements bribes via
 *         `VotingReward.sol` per-gauge contracts created by
 *         `VotingRewardsFactory.sol` — a different shape than this single-
 *         entry interface. This interface is the simpler shape STORY-003 and
 *         STORY-008 are built around; an adapter for the real Tigris bribe
 *         pattern will land in STORY-005+ once subgraph data is wired.
 */
interface IMatchbox {
    /**
     * @notice Claim accumulated bribes/rewards for the given user.
     * @param user Address whose pending rewards should be claimed and forwarded.
     * @return amount The MUSD-denominated amount transferred to `user`.
     */
    function claim(address user) external returns (uint256 amount);

    /**
     * @notice Read the user's currently-pending claimable balance.
     * @dev Used by the frontend (STORY-008) via wagmi `useReadContract` to
     *      decide whether the Claim button is enabled. Pure view, no gas.
     */
    function pending(address user) external view returns (uint256);
}
