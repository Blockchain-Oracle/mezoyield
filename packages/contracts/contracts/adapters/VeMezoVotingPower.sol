// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMezoVeMEZO} from "../interfaces/external/IMezoVeMEZO.sol";

/**
 * @title VeMezoVotingPower
 * @notice Bridges the ERC-721 veMEZO lock model to the 18-decimal
 *         `balanceOf(address) → uint256` shape our optimizer reads.
 *
 *         Sums voting power across every veMEZO NFT the user holds,
 *         applying the live boost + time-decay built into veMEZO's
 *         `votingPowerOfNFT`. Mainnet locks decay linearly over their
 *         duration, so the read reflects the wallet's CURRENT voting
 *         power, not the original locked amount.
 *
 *         Frontend impact (#33 — auto-faucet path): the activation
 *         flow's `MockVeMezo.balanceOf` read swaps to this adapter on
 *         mainnet. If a connected wallet has 0 veMEZO NFTs, this
 *         returns 0 — the activation flow then surfaces the "lock MEZO
 *         first" CTA instead of trying to call a faucet that doesn't
 *         exist on mainnet.
 *
 *         No `faucet()`. Calling it on mainnet should revert at the
 *         consumer layer (the activation hook only invokes faucet when
 *         chain id == 31611). For belt-and-braces, the deployed adapter
 *         simply doesn't expose a faucet selector.
 */
contract VeMezoVotingPower {
    /// @notice The upstream veMEZO NFT contract. Immutable at deploy time.
    IMezoVeMEZO public immutable veMezo;

    constructor(IMezoVeMEZO _veMezo) {
        veMezo = _veMezo;
    }

    /**
     * @notice Sum of voting power across every veMEZO NFT held by `user`.
     * @dev Uses ERC-721 Enumerable's `tokenOfOwnerByIndex` to iterate.
     *      Each read is a view, so the gas cost is borne by the caller
     *      (the wagmi RPC) — not by transactions. O(n) in the user's NFT
     *      count, which is bounded by their lock activity.
     */
    function balanceOf(address user) external view returns (uint256 power) {
        uint256 n = veMezo.balanceOf(user);
        for (uint256 i = 0; i < n; ++i) {
            uint256 tokenId = veMezo.tokenOfOwnerByIndex(user, i);
            power += veMezo.votingPowerOfNFT(tokenId);
        }
    }

    /**
     * @notice Pass-through total voting power across the protocol.
     * @dev Used by `useProtocolStrategyMix` etc. so the share readout's
     *      denominator is the real Mezo protocol total, not a stale
     *      cached value.
     */
    function totalSupply() external view returns (uint256) {
        return veMezo.totalVotingPower();
    }
}
