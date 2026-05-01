import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/**
 * Unit coverage for the STORY-005 additions to the mock contracts:
 *   - MockGaugeController: addGauge / gauges / gaugeCount / gaugeMeta /
 *     gaugeAddressFor (deterministic name → address)
 *   - MockMatchbox: setBribe / bribeForGauge
 *
 * These mocks are deployed to Mezo testnet alongside the optimizer (see
 * `deployments/mezo-testnet.json`). We cover the surfaces the frontend
 * dashboard reads via wagmi `useReadContracts`, so a regression in the
 * mock state (e.g. forgetting to push to `_gaugeList` on `addGauge`)
 * fails CI before the dashboard breaks.
 */
describe("Mocks (STORY-005 additions)", () => {
  async function fixture() {
    const [deployer, other] = await ethers.getSigners();
    const GC = await ethers.getContractFactory("MockGaugeController");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gc: any = await GC.deploy();
    await gc.waitForDeployment();
    const MB = await ethers.getContractFactory("MockMatchbox");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mb: any = await MB.deploy();
    await mb.waitForDeployment();
    return { gc, mb, deployer, other };
  }

  describe("MockGaugeController", () => {
    it("registers a gauge with deterministic address derived from name", async () => {
      const { gc } = await loadFixture(fixture);
      const expected = await gc.gaugeAddressFor("Stability Pool");
      const tx = await gc.addGauge("Stability Pool", 12_500_000n);
      await expect(tx)
        .to.emit(gc, "MockGaugeRegistered")
        .withArgs(expected, "Stability Pool", 12_500_000n);

      const list: string[] = await gc.gauges();
      expect(list).to.deep.equal([expected]);
      expect(await gc.gaugeCount()).to.equal(1n);

      const [name, total] = await gc.gaugeMeta(expected);
      expect(name).to.equal("Stability Pool");
      expect(total).to.equal(12_500_000n);
    });

    it("derives distinct addresses for distinct names", async () => {
      const { gc } = await loadFixture(fixture);
      const a = await gc.gaugeAddressFor("Stability Pool");
      const b = await gc.gaugeAddressFor("MUSD Savings Rate");
      const c = await gc.gaugeAddressFor("BTC-MUSD LP");
      expect(a).to.not.equal(b);
      expect(b).to.not.equal(c);
      expect(a).to.not.equal(c);
    });

    it("is idempotent: re-registering the same name updates totalVeMezo without duplicating list", async () => {
      const { gc } = await loadFixture(fixture);
      await gc.addGauge("Foo", 100n);
      await gc.addGauge("Foo", 200n);
      const list: string[] = await gc.gauges();
      expect(list.length).to.equal(1);
      const [, total] = await gc.gaugeMeta(list[0]);
      expect(total).to.equal(200n);
    });

    it("returns an empty registry when nothing has been registered", async () => {
      const { gc } = await loadFixture(fixture);
      expect(await gc.gaugeCount()).to.equal(0n);
      const list: string[] = await gc.gauges();
      expect(list).to.deep.equal([]);
    });

    it("preserves the STORY-003 vote-recording behavior alongside the registry", async () => {
      const { gc, deployer } = await loadFixture(fixture);
      // Run a vote, then make sure the registry calls don't clobber it.
      await gc.voteForGaugeWeights(
        ["0x0000000000000000000000000000000000000001"],
        [10_000n],
      );
      await gc.addGauge("Some Gauge", 1n);
      expect(await gc.lastVoter()).to.equal(deployer.address);
      expect(await gc.voteCount()).to.equal(1n);
    });
  });

  describe("MockMatchbox", () => {
    it("returns 0 for unset gauges (no synthetic data)", async () => {
      const { mb } = await loadFixture(fixture);
      expect(await mb.bribeForGauge("0x0000000000000000000000000000000000000123")).to.equal(0n);
    });

    it("setBribe writes per-gauge state and emits", async () => {
      const { mb } = await loadFixture(fixture);
      const gauge = "0x0000000000000000000000000000000000000123";
      await expect(mb.setBribe(gauge, 8_400n))
        .to.emit(mb, "BribeSet")
        .withArgs(gauge, 8_400n);
      expect(await mb.bribeForGauge(gauge)).to.equal(8_400n);
    });

    it("does not collide with the per-user pending storage", async () => {
      const { mb, deployer, other } = await loadFixture(fixture);
      // Set per-user pending and per-gauge bribe; verify they're separate slots.
      await mb.setPending(deployer.address, 999n);
      await mb.setBribe(other.address, 111n);
      expect(await mb.pending(deployer.address)).to.equal(999n);
      expect(await mb.bribeForGauge(other.address)).to.equal(111n);
      // The user's pending should NOT show up as a per-gauge bribe (different mappings).
      expect(await mb.bribeForGauge(deployer.address)).to.equal(0n);
    });
  });
});
