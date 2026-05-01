import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/**
 * Unit tests for MockVeMezo (STORY-006). Real Mezo veMEZO is a Solidly-
 * style veNFT; the mock collapses to ERC-20 `balanceOf` for the
 * dashboard's STORY-006 BDD ("display my veMEZO balance in
 * human-readable format"). A future tigris-adapter story will swap to the
 * real NFT shape.
 */
describe("MockVeMezo", () => {
  async function fixture() {
    const [deployer, user, other] = await ethers.getSigners();
    const F = await ethers.getContractFactory("MockVeMezo");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ve: any = await F.deploy();
    await ve.waitForDeployment();
    return { ve, deployer, user, other };
  }

  it("starts with zero balance + zero supply", async () => {
    const { ve, user } = await loadFixture(fixture);
    expect(await ve.balanceOf(user.address)).to.equal(0n);
    expect(await ve.totalSupply()).to.equal(0n);
  });

  it("faucet credits the caller with 1_000 veMEZO", async () => {
    const { ve, user } = await loadFixture(fixture);
    const expected = 1_000n * 10n ** 18n;
    await expect(ve.connect(user).faucet())
      .to.emit(ve, "Minted")
      .withArgs(user.address, expected);
    expect(await ve.balanceOf(user.address)).to.equal(expected);
    expect(await ve.totalSupply()).to.equal(expected);
  });

  it("faucet is additive on repeat call", async () => {
    const { ve, user } = await loadFixture(fixture);
    await ve.connect(user).faucet();
    await ve.connect(user).faucet();
    expect(await ve.balanceOf(user.address)).to.equal(2n * 1_000n * 10n ** 18n);
  });

  it("mint(addr, amount) targets the given address (deployer seed flow)", async () => {
    const { ve, deployer, other } = await loadFixture(fixture);
    const seed = 1500n * 10n ** 18n;
    await ve.connect(deployer).mint(other.address, seed);
    expect(await ve.balanceOf(other.address)).to.equal(seed);
    expect(await ve.balanceOf(deployer.address)).to.equal(0n);
  });

  it("does not collide between users", async () => {
    const { ve, user, other } = await loadFixture(fixture);
    await ve.connect(user).faucet();
    expect(await ve.balanceOf(user.address)).to.equal(1_000n * 10n ** 18n);
    expect(await ve.balanceOf(other.address)).to.equal(0n);
  });
});
