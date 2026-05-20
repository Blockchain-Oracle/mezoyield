// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBribeVotingReward — per-gauge bribe contract surface
 * @notice On Mezo mainnet each gauge has its own `BribeVotingReward`
 *         child contract (Solidly pattern). Bribes are deposited per
 *         gauge per epoch and claimed per veMEZO tokenId.
 *
 *         The `claimBribes` flow on the BoostVoter handles the call
 *         dispatch — the adapter doesn't need to call BribeVotingReward
 *         directly for claims. But to compute pending rewards in advance
 *         (for the `pending(user)` IMatchbox surface) the adapter reads
 *         `earned(token, tokenId)` directly on each bribe contract.
 */
interface IBribeVotingReward {
    /// @notice Currently-earned `rewardToken` balance for `tokenId`.
    function earned(address rewardToken, uint256 tokenId)
        external
        view
        returns (uint256);
}
