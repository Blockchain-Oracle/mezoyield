// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMezoBoostVoter — minimal upstream interface for Mezo's BoostVoter
 * @notice The BoostVoter is a Solidly-derived `Voter` with a boost mechanic
 *         on top. Its mainnet proxy lives at `0x2ba614…` (impl `0xA696Dc56…`)
 *         per the `external.MezoBoostVoter` field in
 *         `deployments/mezo-mainnet.json`.
 *
 *         The full ABI has ~98 entries; this interface declares only the
 *         functions the adapters call so the Solidity compiler can typecheck
 *         the wrapping. The ABI on-chain was verified via explorer fetch
 *         on 2026-05-20 — any future Mezo upgrade that changes these
 *         signatures must be reflected here AND in the adapters.
 *
 *         Critical shape note: every state-changing function is keyed by
 *         `tokenId` (the veMEZO NFT), not by address. Multi-NFT users
 *         must call per-token. Our v1 adapters assume one NFT per user.
 */
interface IMezoBoostVoter {
    /// @notice Submit gauge weights from a specific veMEZO NFT.
    /// @param tokenId The veMEZO NFT id voting.
    /// @param gauges Gauge addresses to vote for.
    /// @param weights Voting weights — units are protocol-defined; the
    ///                BoostVoter normalizes internally.
    function vote(
        uint256 tokenId,
        address[] calldata gauges,
        uint256[] calldata weights
    ) external;

    /// @notice Return whether `gauge` is a registered gauge.
    function isGauge(address gauge) external view returns (bool);

    /// @notice Return the bribe contract paired with `gauge`. Returns
    ///         `address(0)` if no bribe market exists for it.
    function gaugeToBribe(address gauge) external view returns (address);

    /// @notice Claim bribes across the given bribe contracts for the
    ///         given `tokenId`. `tokens[i]` is the list of reward tokens
    ///         to claim from `bribes[i]`.
    function claimBribes(
        address[] calldata bribes,
        address[][] calldata tokens,
        uint256 tokenId
    ) external;

    /// @notice Read the gauge at `index` in the protocol-wide gauge list.
    ///         There's no `gauges() → address[]` getter; iteration must
    ///         use a known upper bound.
    function gauges(uint256 index) external view returns (address);

    /// @notice The user's vote weight cast for `gauge` from `tokenId`.
    ///         Useful for "what gauges did this token vote on?" reads.
    function votes(uint256 tokenId, address gauge) external view returns (uint256);
}
