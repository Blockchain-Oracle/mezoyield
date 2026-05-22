// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IMatchbox} from "../interfaces/IMatchbox.sol";
import {IMezoBoostVoter} from "../interfaces/external/IMezoBoostVoter.sol";
import {IMezoVeMEZO} from "../interfaces/external/IMezoVeMEZO.sol";
import {IBribeVotingReward} from "../interfaces/external/IBribeVotingReward.sol";

/**
 * @title MatchboxAdapter
 * @notice Mezo mainnet has no singleton bribe market — bribes live in
 *         per-gauge `BribeVotingReward` children created by the
 *         BoostVoter. This adapter multiplexes the per-gauge contracts
 *         behind the singleton-shaped `IMatchbox` surface our optimizer
 *         calls.
 *
 *         The owner registers the set of gauges to claim across via
 *         `setTrackedGauges` (called once after deploy, with the live
 *         gauge list from the BoostVoter). The frontend doesn't need
 *         to know any of this — it just calls `pending(user)` and
 *         `claim(user)` as if a singleton existed.
 *
 *         Reward token assumption: all bribes pay in MUSD on mainnet.
 *         A multi-token claim path could be added if/when other reward
 *         tokens show up — out of scope for v1 per #31.
 *
 *         v1 limitations (mirror BoostVoterAdapter):
 *
 *           - Single-NFT assumption. Uses the caller's first veMEZO
 *             token (Enumerable index 0). Multi-NFT users need a
 *             per-token claim flow that's deferred.
 *
 *           - No `pending` accumulation across un-tracked gauges. If
 *             a gauge is added to BoostVoter after `setTrackedGauges`
 *             was last called, its rewards won't be summed until the
 *             owner re-registers. The Optimizer's keeper bot triggers
 *             this re-registration on epoch boundaries.
 */
contract MatchboxAdapter is IMatchbox {
    IMezoBoostVoter public immutable boostVoter;
    IMezoVeMEZO public immutable veMezo;
    address public immutable rewardToken;
    address public owner;

    address[] private _trackedGauges;

    // Per-gauge cached bribe amount in `rewardToken` (MUSD on mainnet).
    // The keeper's `loadGauges` reads this via `bribeForGauge(gauge)` to
    // score each gauge for optimal vote allocation. Same shape as testnet's
    // MockMatchbox — owner-managed because Mezo mainnet has no
    // protocol-wide bribe getter (per-gauge BribeVotingReward only
    // exposes `earned(token, tokenId)` which requires a vote source).
    mapping(address => uint256) private _bribeForGauge;

    event TrackedGaugesSet(uint256 count);
    event BribeUpdated(address indexed gauge, uint256 amount);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error CallerHasNoVeMezo();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        IMezoBoostVoter _boostVoter,
        IMezoVeMEZO _veMezo,
        address _rewardToken
    ) {
        boostVoter = _boostVoter;
        veMezo = _veMezo;
        rewardToken = _rewardToken;
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    /// @notice Set the list of gauges to aggregate bribe claims over.
    ///         Typically called once post-deploy with the full BoostVoter
    ///         gauge list, then re-called only when a new gauge is added
    ///         upstream.
    function setTrackedGauges(address[] calldata gauges) external onlyOwner {
        delete _trackedGauges;
        for (uint256 i = 0; i < gauges.length; ++i) {
            _trackedGauges.push(gauges[i]);
        }
        emit TrackedGaugesSet(gauges.length);
    }

    function trackedGaugesCount() external view returns (uint256) {
        return _trackedGauges.length;
    }

    function trackedGaugeAt(uint256 index) external view returns (address) {
        return _trackedGauges[index];
    }

    /// @notice Current bribe MUSD attributed to `gauge`. Used by the
    /// keeper's `loadGauges` + frontend's `useGaugeData` to score
    /// gauges for vote allocation. Returns 0 for unknown gauges.
    function bribeForGauge(address gauge) external view returns (uint256) {
        return _bribeForGauge[gauge];
    }

    /// @notice Owner updates the cached bribe per gauge. Typically
    /// called by an off-chain refresh process at epoch boundaries.
    function setBribeForGauge(address gauge, uint256 amount) external onlyOwner {
        _bribeForGauge[gauge] = amount;
        emit BribeUpdated(gauge, amount);
    }

    /// @notice Batch helper — same as calling setBribeForGauge in a loop.
    function setBribesForGauges(address[] calldata gauges_, uint256[] calldata amounts) external onlyOwner {
        require(gauges_.length == amounts.length, "length mismatch");
        for (uint256 i; i < gauges_.length; ++i) {
            _bribeForGauge[gauges_[i]] = amounts[i];
            emit BribeUpdated(gauges_[i], amounts[i]);
        }
    }

    /// @inheritdoc IMatchbox
    /// @dev Sums `BribeVotingReward.earned(rewardToken, tokenId)` across
    ///      all tracked gauges' bribe contracts. View only — used by the
    ///      claim button's enable/disable check.
    function pending(address user) external view override returns (uint256 total) {
        uint256 n = veMezo.balanceOf(user);
        if (n == 0) return 0;
        uint256 tokenId = veMezo.ownerToNFTokenIdList(user, 0);

        for (uint256 i = 0; i < _trackedGauges.length; ++i) {
            address bribe = boostVoter.gaugeToBribe(_trackedGauges[i]);
            if (bribe == address(0)) continue;
            total += IBribeVotingReward(bribe).earned(rewardToken, tokenId);
        }
    }

    /// @inheritdoc IMatchbox
    /// @dev Builds the `bribes[]` + `tokens[][]` arguments the BoostVoter's
    ///      `claimBribes` expects, then forwards under the caller's first
    ///      veMEZO NFT. The BoostVoter handles the per-bribe-contract
    ///      `getReward(tokenId)` calls internally — we don't iterate
    ///      `BribeVotingReward.getReward` directly because the per-token
    ///      authorization happens inside the BoostVoter.
    function claim(address user) external override returns (uint256 amount) {
        if (veMezo.balanceOf(user) == 0) revert CallerHasNoVeMezo();
        uint256 tokenId = veMezo.ownerToNFTokenIdList(user, 0);

        // Build the per-bribe rewardToken[][] array. Every bribe pays
        // in `rewardToken` (MUSD on mainnet) — single-token claim.
        uint256 trackedCount = _trackedGauges.length;
        address[] memory bribes = new address[](trackedCount);
        address[][] memory tokens = new address[][](trackedCount);
        uint256 valid = 0;
        for (uint256 i = 0; i < trackedCount; ++i) {
            address bribe = boostVoter.gaugeToBribe(_trackedGauges[i]);
            if (bribe == address(0)) continue;
            bribes[valid] = bribe;
            address[] memory tokenList = new address[](1);
            tokenList[0] = rewardToken;
            tokens[valid] = tokenList;
            ++valid;
        }
        // Shrink to the populated length so BoostVoter doesn't dispatch
        // to zero addresses.
        assembly {
            mstore(bribes, valid)
            mstore(tokens, valid)
        }

        boostVoter.claimBribes(bribes, tokens, tokenId);

        // BoostVoter sends rewards directly to the tokenId's owner
        // (msg.sender of this call → user). The `amount` returned is
        // informational; downstream consumers (e.g. ClaimButton's toast)
        // can read post-state via `pending` to confirm zero.
        amount = 0;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address prev = owner;
        owner = newOwner;
        emit OwnerTransferred(prev, newOwner);
    }
}
