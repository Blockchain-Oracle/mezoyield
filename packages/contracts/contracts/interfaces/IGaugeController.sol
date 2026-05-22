// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGaugeController — minimal interface used by MezoYieldOptimizer
 * @notice This is a SIMPLIFIED Curve/Votium-style surface that the optimizer
 *         calls when forwarding a vote. The real Mezo gauge system (see
 *         `mezo-org/tigris`'s `Voter.sol`, cloned at
 *         `context/refs/repos/tigris/`) uses a Solidly-style API
 *         (`vote(uint256 tokenId, address[] pools, uint256[] weights)`) and
 *         is veNFT-based, not address-based. The minimal interface here
 *         exists because STORY-003's BDD acceptance literally encodes
 *         basis-points-summing-to-10000 semantics; STORY-005+ will introduce
 *         an adapter layer that translates this Curve-shape into Tigris's
 *         Solidly-shape against a real on-chain veNFT position.
 *
 *         Until then, deployments use `MockGaugeController.sol` so the demo
 *         can run end-to-end against real testnet state without depending on
 *         Mezo publishing canonical gauge addresses (CONTEXT.md OQ #6).
 */
interface IGaugeController {
    /**
     * @notice Submit gauge weights on behalf of the caller.
     * @param gauges Gauge addresses to vote for, parallel to `weights`.
     * @param weights Voting weights in basis points, parallel to `gauges`.
     *                The optimizer pre-validates `sum(weights) == 10000`,
     *                but the gauge controller MAY enforce its own bounds.
     */
    function voteForGaugeWeights(address[] calldata gauges, uint256[] calldata weights) external;

    /**
     * @notice Submit gauge weights using `voter`'s veMEZO NFT, not the caller's.
     *         Used by `MezoYieldOptimizer.castOptimalVote` to fan out votes
     *         across all delegated users in a single keeper transaction. The
     *         adapter MUST verify that the caller is the configured optimizer
     *         (so arbitrary contracts cannot pass an unrelated address through
     *         and trigger a vote from someone else's NFT) and that `voter`
     *         actually owns at least one veMEZO NFT.
     * @param voter The veMEZO holder whose NFT casts the vote. The adapter
     *              uses `voter`'s first NFT (token-of-owner-by-index 0).
     * @param gauges Gauge addresses to vote for, parallel to `weights`.
     * @param weights Voting weights in basis points, parallel to `gauges`.
     */
    function voteForUser(
        address voter,
        address[] calldata gauges,
        uint256[] calldata weights
    ) external;
}
