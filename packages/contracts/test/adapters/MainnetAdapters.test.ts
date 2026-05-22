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

    // Registry surface (READ — keeper + frontend's useGaugeData call this).
    // The original v1 omitted gauges() / gaugeMeta() entirely; the keeper's
    // boot tick reverted on first read. Locking in the registry shape so
    // we don't regress.

    it("gauges() returns [] when no gauges registered yet", async () => {
      const { voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      expect(await adapter.gauges()).to.deep.equal([]);
      expect(await adapter.gaugeCount()).to.equal(0n);
    });

    it("registerGauge stores name + totalVeMezo and adds to gauges() list", async () => {
      const { voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );

      const gauge = "0x000000000000000000000000000000000000A001";
      await adapter.registerGauge(gauge, "Stability Pool", 12_500_000n * 10n ** 18n);

      expect(await adapter.gauges()).to.deep.equal([gauge]);
      const [name, weight] = await adapter.gaugeMeta(gauge);
      expect(name).to.equal("Stability Pool");
      expect(weight).to.equal(12_500_000n * 10n ** 18n);
    });

    it("registerGauges batch helper preserves order and weights", async () => {
      const { voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );

      const gauges = [
        "0x000000000000000000000000000000000000A001",
        "0x000000000000000000000000000000000000A002",
        "0x000000000000000000000000000000000000A003",
      ];
      const names = ["Stability Pool", "MUSD Savings Rate", "BTC-MUSD LP"];
      const totals = [
        12_500_000n * 10n ** 18n,
        9_200_000n * 10n ** 18n,
        6_700_000n * 10n ** 18n,
      ];

      await adapter.registerGauges(gauges, names, totals);

      expect(await adapter.gauges()).to.deep.equal(gauges);
      for (let i = 0; i < gauges.length; i++) {
        const [n, w] = await adapter.gaugeMeta(gauges[i]);
        expect(n).to.equal(names[i]);
        expect(w).to.equal(totals[i]);
      }
    });

    it("gaugeMeta returns ('', 0) for unregistered addresses (no revert)", async () => {
      const { voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      const [name, weight] = await adapter.gaugeMeta(
        "0x0000000000000000000000000000000000000099",
      );
      expect(name).to.equal("");
      expect(weight).to.equal(0n);
    });

    it("updateGaugeWeight refreshes a registered gauge's weight", async () => {
      const { voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      const gauge = "0x000000000000000000000000000000000000A001";
      await adapter.registerGauge(gauge, "Stability Pool", 1_000n);
      await adapter.updateGaugeWeight(gauge, 9_999n);
      const [, w] = await adapter.gaugeMeta(gauge);
      expect(w).to.equal(9_999n);
    });

    it("updateGaugeWeight reverts UnknownGauge for unregistered address", async () => {
      const { voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      await expect(
        adapter.updateGaugeWeight(
          "0x0000000000000000000000000000000000000099",
          1n,
        ),
      ).to.be.revertedWithCustomError(adapter, "UnknownGauge");
    });

    it("registerGauge is owner-only", async () => {
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
          .registerGauge(
            "0x000000000000000000000000000000000000A001",
            "x",
            1n,
          ),
      ).to.be.revertedWithCustomError(adapter, "NotOwner");
    });

    // ─── voteForUser + optimizer wiring (the v3 fix) ─────────────
    // The mainnet keeper-side flow now goes:
    //   Keeper → Optimizer.castOptimalVote → Adapter.voteForUser(user, …)
    //                                         ↑ onlyOptimizer
    // These tests lock in the auth path: only the registered optimizer
    // can call voteForUser, only the voter's NFT is used as the source,
    // and the previous msg.sender-driven path (voteForGaugeWeights) is
    // unaffected.

    it("voteForUser reverts NotOptimizer when caller is not the configured optimizer", async () => {
      const { alice, voter, veMezo } = await setup();
      await veMezo.mintLockFor(alice.address, 1_000n * 10n ** 18n);
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      // optimizer slot is unset → any caller is unauthorized
      await expect(
        adapter
          .connect(alice)
          .voteForUser(alice.address, ["0x0000000000000000000000000000000000000001"], [10000n]),
      ).to.be.revertedWithCustomError(adapter, "NotOptimizer");
    });

    it("voteForUser reverts VoterHasNoVeMezo when voter holds no NFT", async () => {
      const { alice, bob, voter, veMezo } = await setup();
      // Alice will pose as the optimizer (deployer of the adapter, so she
      // can call setOptimizer to wire herself in).
      const [deployer] = await ethers.getSigners();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      await adapter.connect(deployer).setOptimizer(alice.address);

      // bob has no NFT
      await expect(
        adapter
          .connect(alice)
          .voteForUser(bob.address, ["0x0000000000000000000000000000000000000001"], [10000n]),
      ).to.be.revertedWithCustomError(adapter, "VoterHasNoVeMezo");
    });

    it("voteForUser forwards to BoostVoter under voter's tokenId when optimizer calls", async () => {
      const { alice, voter, veMezo } = await setup();
      // alice is the NFT holder; deployer = signer 0; signer 2 (bob slot)
      // poses as the optimizer for this test.
      const [deployer, , bob] = await ethers.getSigners();
      const ONE_K = 1_000n * 10n ** 18n;
      await veMezo.mintLockFor(alice.address, ONE_K);
      const aliceTokenId = await veMezo.tokenOfOwnerByIndex(alice.address, 0);

      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      await adapter.connect(deployer).setOptimizer(bob.address);

      const gauges = [
        "0x000000000000000000000000000000000000a001",
        "0x000000000000000000000000000000000000a002",
      ];
      const weights = [6000n, 4000n];

      await adapter.connect(bob).voteForUser(alice.address, gauges, weights);

      expect(await voter.voteCallCount()).to.equal(1n);
      expect(await voter.lastVoteTokenId()).to.equal(aliceTokenId);
      expect((await voter.lastVoteGauges(0)).toLowerCase()).to.equal(gauges[0]);
      expect((await voter.lastVoteGauges(1)).toLowerCase()).to.equal(gauges[1]);
      expect(await voter.lastVoteWeights(0)).to.equal(weights[0]);
      expect(await voter.lastVoteWeights(1)).to.equal(weights[1]);
    });

    it("setOptimizer is owner-only and rejects zero address; emits OptimizerUpdated", async () => {
      const { alice, bob, voter, veMezo } = await setup();
      const Adapter = await ethers.getContractFactory("BoostVoterAdapter");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter: any = await Adapter.deploy(
        await voter.getAddress(),
        await veMezo.getAddress(),
      );
      await expect(
        adapter.connect(bob).setOptimizer(alice.address),
      ).to.be.revertedWithCustomError(adapter, "NotOwner");
      await expect(
        adapter.setOptimizer("0x0000000000000000000000000000000000000000"),
      ).to.be.revertedWithCustomError(adapter, "ZeroAddress");

      await expect(adapter.setOptimizer(alice.address))
        .to.emit(adapter, "OptimizerUpdated")
        .withArgs("0x0000000000000000000000000000000000000000", alice.address);
      expect(await adapter.optimizer()).to.equal(alice.address);
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

    // ─── Bribe cache (keeper + frontend read this) ────────────────
    // Codex P1 on PR #44: the bribe-cache API shipped without tests.
    // Locking in owner-gating, batch length-check, and readback.

    it("bribeForGauge returns 0 for unset gauge", async () => {
      const { adapter, gaugeA } = await setupMatchbox();
      expect(await adapter.bribeForGauge(gaugeA)).to.equal(0n);
    });

    it("setBribeForGauge stores the value, bribeForGauge reads it back", async () => {
      const { adapter, gaugeA } = await setupMatchbox();
      const amount = 8_400n * 10n ** 18n;
      await adapter.setBribeForGauge(gaugeA, amount);
      expect(await adapter.bribeForGauge(gaugeA)).to.equal(amount);
    });

    it("setBribesForGauges batch helper sets multiple at once", async () => {
      const { adapter, gaugeA, gaugeB } = await setupMatchbox();
      const a = 1_000n * 10n ** 18n;
      const b = 2_500n * 10n ** 18n;
      await adapter.setBribesForGauges([gaugeA, gaugeB], [a, b]);
      expect(await adapter.bribeForGauge(gaugeA)).to.equal(a);
      expect(await adapter.bribeForGauge(gaugeB)).to.equal(b);
    });

    it("setBribesForGauges reverts on length mismatch", async () => {
      const { adapter, gaugeA, gaugeB } = await setupMatchbox();
      await expect(
        adapter.setBribesForGauges([gaugeA, gaugeB], [1n]),
      ).to.be.revertedWith("length mismatch");
    });

    it("setBribeForGauge is owner-only", async () => {
      const { bob, adapter, gaugeA } = await setupMatchbox();
      await expect(
        adapter.connect(bob).setBribeForGauge(gaugeA, 1n),
      ).to.be.revertedWithCustomError(adapter, "NotOwner");
    });

    it("setBribesForGauges is owner-only", async () => {
      const { bob, adapter, gaugeA } = await setupMatchbox();
      await expect(
        adapter.connect(bob).setBribesForGauges([gaugeA], [1n]),
      ).to.be.revertedWithCustomError(adapter, "NotOwner");
    });

    it("updating the same gauge overwrites the cached bribe", async () => {
      const { adapter, gaugeA } = await setupMatchbox();
      await adapter.setBribeForGauge(gaugeA, 100n);
      await adapter.setBribeForGauge(gaugeA, 999n);
      expect(await adapter.bribeForGauge(gaugeA)).to.equal(999n);
    });
  });
});
