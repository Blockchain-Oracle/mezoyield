// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMatchbox} from "../interfaces/IMatchbox.sol";

/**
 * @title MockMatchbox
 * @notice Test/testnet stand-in for Mezo's bribe market. Real Mezo bribes
 *         flow through per-gauge `VotingReward` contracts created by
 *         `VotingRewardsFactory.sol` (see `context/refs/repos/tigris/`),
 *         which is a different shape from this single-entry interface.
 *
 *         The mock lets the frontend exercise the full claim flow against
 *         real testnet state without depending on Mezo publishing canonical
 *         bribe-market addresses (CONTEXT.md OQ #6).
 *
 *         Pending balances are configured per-user via `setPending` for
 *         deterministic tests. `claim` zeros the pending balance and emits
 *         a Claimed event so on-chain observers can audit.
 */
contract MockMatchbox is IMatchbox {
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
}
