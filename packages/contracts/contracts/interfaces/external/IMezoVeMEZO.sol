// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMezoVeMEZO — minimal upstream interface for Mezo's veMEZO NFT
 * @notice veMEZO is an ERC-721 vote-escrow lock. Each lock is a unique
 *         tokenId; the user holds one or more NFTs. The mainnet
 *         transparent proxy is at `0xb90fdAd…` (impl `0xA1aCc19a…`).
 *
 *         The adapters call only the subset of methods declared here.
 *         Verified against the deployed impl's ABI on 2026-05-20.
 */
interface IMezoVeMEZO {
    /// @notice ERC-721 count of NFTs owned by `user`.
    /// @dev On the real veMEZO this is the NFT count — NOT voting power.
    function balanceOf(address user) external view returns (uint256);

    /// @notice ERC-721 owner of a given lock token.
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Enumerate the user's tokens by index. Inherited from
    ///         ERC-721 Enumerable; required by adapters that don't
    ///         track token ids themselves.
    function tokenOfOwnerByIndex(address owner, uint256 index)
        external
        view
        returns (uint256);

    /// @notice Current voting power of an individual NFT (boost applied,
    ///         time-decay applied). Returned in 18-decimal voting units —
    ///         matches the units our optimizer reads.
    function votingPowerOfNFT(uint256 tokenId) external view returns (uint256);

    /// @notice Protocol-wide voting power. Used by mix / share readouts.
    function totalVotingPower() external view returns (uint256);
}
