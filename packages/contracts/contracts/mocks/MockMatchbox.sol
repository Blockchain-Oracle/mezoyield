// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMatchbox} from "../interfaces/IMatchbox.sol";

/**
 * @title MockMatchbox
 * @notice Test/testnet stand-in for Mezo's bribe market. Real Mezo bribes
 *         flow through per-gauge `VotingReward` contracts created by
 *         `VotingRewardsFactory.sol` (see `context/refs/repos/tigris/`),
 *         which is a different shape than this single-entry interface.
 *
 *         Pending balances are configured per-user via `setPending` for
 *         deterministic tests. `claim` zeros the pending balance and emits
 *         a Claimed event so on-chain observers can audit.
 *
 *         STORY-005 surface: in addition to the per-user pending balances
 *         used by claimRewards, this mock now exposes a per-gauge bribe
 *         pool the Dashboard can read to compute APY estimates. The
 *         deploy script seeds these alongside the gauge registry on
 *         MockGaugeController so frontend reads are end-to-end against
 *         real on-chain state via wagmi `useReadContracts`.
 */
contract MockMatchbox is IMatchbox {
    // -------- Per-user pending (unchanged from STORY-003) --------

    mapping(address user => uint256 amount) private _pending;

    event PendingSet(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    /// @notice Configure pending balance for testing. Not present on real Matchbox.
    function setPending(address user, uint256 amount) external {
        _pending[user] = amount;
        emit PendingSet(user, amount);
    }

    function pending(address user) external view override returns (uint256) {
        return _pending[user];
    }

    function claim(address user) external override returns (uint256 amount) {
        amount = _pending[user];
        _pending[user] = 0;
        emit Claimed(user, amount);
    }

    // -------- Per-gauge bribe pool (STORY-005) --------

    /// @dev MUSD-denominated bribes posted at this gauge for the current epoch.
    mapping(address gauge => uint256 musdAmount) private _bribePerGauge;

    event BribeSet(address indexed gauge, uint256 musdAmount);

    /// @notice Configure the bribe MUSD amount for a gauge. Not on real Matchbox.
    function setBribe(address gauge, uint256 musdAmount) external {
        _bribePerGauge[gauge] = musdAmount;
        emit BribeSet(gauge, musdAmount);
    }

    /// @notice Read the current MUSD bribe pool for a gauge.
    function bribeForGauge(address gauge) external view returns (uint256) {
        return _bribePerGauge[gauge];
    }
}
