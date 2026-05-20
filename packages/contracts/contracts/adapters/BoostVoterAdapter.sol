// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGaugeController} from "../interfaces/IGaugeController.sol";
import {IMezoBoostVoter} from "../interfaces/external/IMezoBoostVoter.sol";
import {IMezoVeMEZO} from "../interfaces/external/IMezoVeMEZO.sol";

/**
 * @title BoostVoterAdapter
 * @notice Bridges MezoYieldOptimizer's address-keyed gauge surface to
 *         Mezo mainnet's tokenId-keyed BoostVoter. When the optimizer
 *         calls `voteForGaugeWeights(gauges, weights)`, this adapter
 *         looks up the caller's first veMEZO NFT and forwards the vote
 *         to BoostVoter under that tokenId.
 *
 * v1 limitations (documented in the linked issue #31 acceptance):
 *
 *   - Single-NFT assumption. If a user holds multiple veMEZO locks, only
 *     their *first* (lowest-index in ERC-721 Enumerable) is voted with.
 *     A multi-NFT vote pattern would either require the optimizer to
 *     pass an explicit tokenId, or this adapter to iterate ALL of the
 *     caller's tokens and split the weights — both bigger redesigns
 *     deferred to a follow-up PR.
 *
 *   - No re-vote semantics. BoostVoter accumulates votes per token per
 *     epoch; the adapter doesn't reset before submitting. The optimizer's
 *     keeper handles re-vote cadence at the epoch boundary.
 *
 *   - Reverts when caller has no veMEZO NFT — `tokenOfOwnerByIndex` on
 *     index 0 reverts on the upstream VeMEZO contract. The optimizer
 *     gates this with `isDelegated` + `votingPowerOfNFT > 0` upstream
 *     so we don't need to add a duplicate guard here.
 */
contract BoostVoterAdapter is IGaugeController {
    /// @notice Mezo's mainnet BoostVoter proxy. Immutable at deploy time.
    IMezoBoostVoter public immutable boostVoter;

    /// @notice Mezo's mainnet veMEZO NFT. Immutable at deploy time.
    IMezoVeMEZO public immutable veMezo;

    error CallerHasNoVeMezo();

    constructor(IMezoBoostVoter _boostVoter, IMezoVeMEZO _veMezo) {
        boostVoter = _boostVoter;
        veMezo = _veMezo;
    }

    /// @inheritdoc IGaugeController
    /// @dev `msg.sender` must own at least one veMEZO NFT. The first
    ///      token (Enumerable index 0) is used as the voting source.
    function voteForGaugeWeights(
        address[] calldata gauges,
        uint256[] calldata weights
    ) external override {
        if (veMezo.balanceOf(msg.sender) == 0) {
            revert CallerHasNoVeMezo();
        }
        uint256 tokenId = veMezo.tokenOfOwnerByIndex(msg.sender, 0);
        boostVoter.vote(tokenId, gauges, weights);
    }
}
