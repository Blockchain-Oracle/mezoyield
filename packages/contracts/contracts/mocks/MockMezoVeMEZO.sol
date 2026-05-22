// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMezoVeMEZO} from "../interfaces/external/IMezoVeMEZO.sol";

/**
 * @title MockMezoVeMEZO — test fixture matching the real veMEZO shape.
 * @notice ERC-721-Enumerable-ish: tracks NFT count + per-owner indexable
 *         token list + per-NFT voting power. Mints are unrestricted so
 *         tests can compose arbitrary scenarios (zero locks, one lock,
 *         multi lock).
 *
 *         Not the same as `MockVeMezo.sol` (the testnet 18-decimal
 *         pseudo-ERC-20 we deploy to Mezo testnet). This mock matches
 *         the *mainnet* veMEZO ABI so the VeMezoVotingPower adapter
 *         can be unit-tested against it.
 */
contract MockMezoVeMEZO is IMezoVeMEZO {
    mapping(address => uint256[]) private _ownerTokens;
    mapping(uint256 => address) private _tokenOwners;
    mapping(uint256 => uint256) private _votingPower;
    uint256 public totalVotingPower_;
    uint256 private _nextId = 1;

    function balanceOf(address user) external view override returns (uint256) {
        return _ownerTokens[user].length;
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        return _tokenOwners[tokenId];
    }

    function ownerToNFTokenIdList(address owner, uint256 index)
        external
        view
        override
        returns (uint256)
    {
        return _ownerTokens[owner][index];
    }

    function votingPowerOfNFT(uint256 tokenId)
        external
        view
        override
        returns (uint256)
    {
        return _votingPower[tokenId];
    }

    function totalVotingPower() external view override returns (uint256) {
        return totalVotingPower_;
    }

    // ───── Test helpers (not part of IMezoVeMEZO) ─────

    function mintLockFor(address to, uint256 votingPower) external returns (uint256 tokenId) {
        tokenId = _nextId++;
        _ownerTokens[to].push(tokenId);
        _tokenOwners[tokenId] = to;
        _votingPower[tokenId] = votingPower;
        totalVotingPower_ += votingPower;
    }
}
