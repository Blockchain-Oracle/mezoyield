import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Unit-test coverage for the Mezo mainnet adapter trio (issue #31):
 *
 *   - BoostVoterAdapter — wraps tokenId-keyed BoostVoter behind the
 *     optimizer's address-keyed `voteForGaugeWeights` interface.
 *   - VeMezoVotingPower — sums per-NFT voting power across a user's
 *     veMEZO NFTs.
 *   - MatchboxAdapter — multiplexes per-gauge BribeVotingReward children
 *     behind the optimizer's singleton-shaped `IMatchbox`.
 *
 * Each test uses the mock upstream contracts (MockMezoBoostVoter,
 * MockMezoVeMEZO, MockBribeVotingReward) — not the real Mezo mainnet.
 * That keeps CI offline and deterministic. A separate fork-test pass
 * (manual, against Boar RPC) validates the same contracts against the
 * real ABIs before any mainnet deploy.
 */
describe("Mezo mainnet adapters (issue #31)", () => {
  async function setup() {
    const [, alice, bob] = await ethers.getSigners();

    // `: any` cast per the existing test convention in
    // MezoYieldOptimizer.test.ts (lines 41-55): hardhat-ethers returns
    // a BaseContract whose typed method names aren't on the static
    // type, but the runtime ABI dispatches correctly. The contracts
    // suite intentionally trades static method typing for not pulling
    // typechain-types into the tsc graph.
    const VoterFactory = await ethers.getContractFactory("MockMezoBoostVoter");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const voter: any = await VoterFactory.deploy();
    await voter.waitForDeployment();

    const VeMezoFactory = await ethers.getContractFactory("MockMezoVeMEZO");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const veMezo: any = await VeMezoFactory.deploy();
    await veMezo.waitForDeployment();

    return { alice, bob, voter, veMezo };
  }

  // ─── BoostVoterAdapter ─────────────────────────────────────────

  describe("BoostVoterAdapter", () => {
    it("forwards vote to BoostVoter under the caller's first veMEZO tokenId", async () => {
      const { alice, voter, veMezo } = await setup();
      // Mint a single lock NFT for Alice with 1000e18 voting power.
      const ONE_K = 1_000n * 10n ** 18n;
      await veMezo.mintLockFor(alice.address, ONE_K);
      const aliceTokenId = await veMezo.tokenOfOwnerByIndex(alice.address, 0);

      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );

      const gauges = [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ];
      const weights = [6000n, 4000n];

      await adapter
        .connect(alice)
        .voteForGaugeWeights(gauges, weights);

      expect(await voter.voteCallCount()).to.equal(1n);
      expect(await voter.lastVoteTokenId()).to.equal(aliceTokenId);
      expect(await voter.lastVoteGauges(0)).to.equal(gauges[0]);
      expect(await voter.lastVoteGauges(1)).to.equal(gauges[1]);
      expect(await voter.lastVoteWeights(0)).to.equal(weights[0]);
      expect(await voter.lastVoteWeights(1)).to.equal(weights[1]);
    });

    it("reverts CallerHasNoVeMezo when caller holds no veMEZO NFT", async () => {
      const { bob, voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );

      await expect(
        adapter
          .connect(bob)
          .voteForGaugeWeights(
            ["0x0000000000000000000000000000000000000001"],
            [10000n],
          ),
      ).to.be.revertedWithCustomError(adapter, "CallerHasNoVeMezo");
    });
  });

  // ─── VeMezoVotingPower ─────────────────────────────────────────

  describe("VeMezoVotingPower", () => {
    it("balanceOf returns 0 for a user with no NFTs", async () => {
      const { bob, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("VeMezoVotingPower");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(await veMezo.getAddress());
      expect(await adapter.balanceOf(bob.address)).to.equal(0n);
    });

    it("balanceOf returns the single-NFT voting power when user has one lock", async () => {
      const { alice, veMezo } = await setup();
      const ONE_K = 1_000n * 10n ** 18n;
      await veMezo.mintLockFor(alice.address, ONE_K);
      const Adapter = await ethers.getContractFactory("VeMezoVotingPower");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(await veMezo.getAddress());
      expect(await adapter.balanceOf(alice.address)).to.equal(ONE_K);
    });

    it("balanceOf sums voting power across multiple locks", async () => {
      const { alice, veMezo } = await setup();
      const A = 500n * 10n ** 18n;
      const B = 1_200n * 10n ** 18n;
      const C = 17n * 10n ** 18n;
      await veMezo.mintLockFor(alice.address, A);
      await veMezo.mintLockFor(alice.address, B);
      await veMezo.mintLockFor(alice.address, C);

      const Adapter = await ethers.getContractFactory("VeMezoVotingPower");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(await veMezo.getAddress());
      expect(await adapter.balanceOf(alice.address)).to.equal(A + B + C);
    });

    it("totalSupply passes through veMEZO's totalVotingPower", async () => {
      const { alice, veMezo } = await setup();
      await veMezo.mintLockFor(alice.address, 2_000n * 10n ** 18n);
      const Adapter = await ethers.getContractFactory("VeMezoVotingPower");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(await veMezo.getAddress());
      expect(await adapter.totalSupply()).to.equal(2_000n * 10n ** 18n);
    });
  });

  // ─── MatchboxAdapter ───────────────────────────────────────────

  describe("MatchboxAdapter", () => {
    async function setupMatchbox() {
      const ctx = await setup();
      const { alice, voter, veMezo } = ctx;

      const MUSD = await ethers.getContractFactory("MockMezoBoostVoter"); // re-use as a dummy 0x address
      // Use a deterministic non-zero address for the reward token.
      const rewardToken = "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186";
      void MUSD;

      const Adapter = await ethers.getContractFactory("MatchboxAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
        rewardToken,
      );

      const BribeFactory = await ethers.getContractFactory(
        "MockBribeVotingReward",
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bribeA: any = await BribeFactory.deploy();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bribeB: any = await BribeFactory.deploy();
      await bribeA.waitForDeployment();
      await bribeB.waitForDeployment();

      const gaugeA = "0x000000000000000000000000000000000000A001";
      const gaugeB = "0x000000000000000000000000000000000000A002";

      await voter.setBribe(gaugeA, await bribeA.getAddress());
      await voter.setBribe(gaugeB, await bribeB.getAddress());

      return { ...ctx, adapter, bribeA, bribeB, gaugeA, gaugeB, rewardToken };
    }

    it("pending returns 0 when no tracked gauges are registered", async () => {
      const { alice, veMezo, adapter } = await setupMatchbox();
      await veMezo.mintLockFor(alice.address, 1_000n * 10n ** 18n);
      expect(await adapter.pending(alice.address)).to.equal(0n);
    });

    it("pending sums earned across tracked gauges' bribe contracts", async () => {
      const { alice, veMezo, adapter, bribeA, bribeB, gaugeA, gaugeB, rewardToken } =
        await setupMatchbox();
      await veMezo.mintLockFor(alice.address, 1_000n * 10n ** 18n);
      const aliceTokenId = await veMezo.tokenOfOwnerByIndex(alice.address, 0);

      // Set per-bribe earned amounts for Alice's tokenId.
      await bribeA.setEarned(rewardToken, aliceTokenId, 7n * 10n ** 18n);
      await bribeB.setEarned(rewardToken, aliceTokenId, 3n * 10n ** 18n);

      await adapter.setTrackedGauges([gaugeA, gaugeB]);

      expect(await adapter.pending(alice.address)).to.equal(10n * 10n ** 18n);
    });

    it("pending returns 0 for a user with no veMEZO NFT (even if gauges are tracked)", async () => {
      const { bob, adapter, gaugeA, gaugeB } = await setupMatchbox();
      await adapter.setTrackedGauges([gaugeA, gaugeB]);
      expect(await adapter.pending(bob.address)).to.equal(0n);
    });

    it("claim forwards claimBribes(bribes, tokens, tokenId) to BoostVoter", async () => {
      const { alice, veMezo, voter, adapter, gaugeA, gaugeB } =
        await setupMatchbox();
      await veMezo.mintLockFor(alice.address, 1_000n * 10n ** 18n);
      const aliceTokenId = await veMezo.tokenOfOwnerByIndex(alice.address, 0);

      await adapter.setTrackedGauges([gaugeA, gaugeB]);

      await adapter.claim(alice.address);

      expect(await voter.claimCallCount()).to.equal(1n);
      expect(await voter.lastClaimTokenId()).to.equal(aliceTokenId);
    });

    it("claim reverts CallerHasNoVeMezo when target user has no NFT", async () => {
      const { bob, adapter, gaugeA } = await setupMatchbox();
      await adapter.setTrackedGauges([gaugeA]);
      await expect(adapter.claim(bob.address)).to.be.revertedWithCustomError(
        adapter,
        "CallerHasNoVeMezo",
      );
    });

    it("setTrackedGauges is owner-only", async () => {
      const { bob, adapter, gaugeA } = await setupMatchbox();
      await expect(
        adapter.connect(bob).setTrackedGauges([gaugeA]),
      ).to.be.revertedWithCustomError(adapter, "NotOwner");
    });

    it("transferOwnership moves ownership", async () => {
      const { alice, adapter } = await setupMatchbox();
      const [deployer] = await ethers.getSigners();
      await adapter.transferOwnership(alice.address);
      expect(await adapter.owner()).to.equal(alice.address);
      // Old owner can no longer call setTrackedGauges
      await expect(
        adapter.connect(deployer).setTrackedGauges([]),
      ).to.be.revertedWithCustomError(adapter, "NotOwner");
    });
  });
});
