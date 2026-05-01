// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockVeMezo
 * @notice Test/testnet stand-in for the user's veMEZO balance. The real
 *         Mezo veMEZO is an ERC-721 voting-escrow NFT (`mezo-org/tigris`'s
 *         VotingEscrow.sol — Solidly-style veNFT). This mock collapses
 *         the position to a simple ERC-20-style `balanceOf` so the
 *         dashboard can render a human-readable veMEZO balance against
 *         real on-chain state without dragging in the full veNFT shape
 *         in STORY-006. STORY-005+ introduces a Tigris adapter; this
 *         mock will be retired then.
 *
 *         Faucet: any address can call `faucet()` to mint themselves
 *         1_000 veMEZO so the demo works for any connected wallet.
 *         `mint(addr, amount)` is unrestricted on the testnet mock to
 *         keep seeding scripts simple. Disclosed in
 *         `deployments/mezo-testnet.json` and TESTNET_ADDRESSES.md.
 */
contract MockVeMezo {
    uint8 public constant DECIMALS = 18;
    string public constant NAME = "Mock veMEZO";
    string public constant SYMBOL = "veMEZO";

    mapping(address user => uint256 balance) public balanceOf;
    uint256 public totalSupply;

    event Minted(address indexed to, uint256 amount);

    /// @notice Self-faucet: mint 1_000 veMEZO to msg.sender so any connecting
    /// wallet sees a non-zero position. No-op-safe to call repeatedly.
    function faucet() external {
        uint256 amount = 1_000 * 10 ** DECIMALS;
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        emit Minted(msg.sender, amount);
    }

    /// @notice Targeted seed for deployer + tests. Unrestricted on the mock —
    /// production veMEZO obviously won't expose this.
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Minted(to, amount);
    }
}
