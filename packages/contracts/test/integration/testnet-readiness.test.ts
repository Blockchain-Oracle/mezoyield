import { expect } from "chai";
import { ethers } from "hardhat";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * End-to-end smoke test against the LIVE Mezo testnet deployment.
 *
 * Reads the committed `deployments/mezo-testnet.json` manifest, then
 * makes read-only RPC calls against the actual chain to confirm the
 * deployed bytecode behaves as the dashboard will read it. This is the
 * "audit before mainnet" Abu asked for: locks the testnet contract
 * surface to the manifest, so a future redeploy that breaks the mock
 * surface (or the manifest schema) trips here before STORY-006+ rely on
 * it.
 *
 * The test is GATED on a dev opt-in via `RUN_TESTNET_INTEGRATION=1`. CI
 * will not hit Mezo testnet for every unit test run — that would be
 * flaky (RPC latency, rate limits) and slow. Run it locally with:
 *   RUN_TESTNET_INTEGRATION=1 pnpm --filter @mezoyield/contracts test
 *
 * The skip path keeps default `pnpm test` runs deterministic and offline.
 */
const RUN = process.env.RUN_TESTNET_INTEGRATION === "1";
const describeOrSkip = RUN ? describe : describe.skip;

describeOrSkip("Mezo testnet integration smoke (live RPC)", function () {
  this.timeout(60_000);

  const manifestPath = resolve(__dirname, "../../deployments/mezo-testnet.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing manifest ${manifestPath}; run pnpm run deploy:testnet first.`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(manifest.rpcUrl);
  const optimizerAddr: string = manifest.contracts.MezoYieldOptimizer.address;
  const gaugeControllerAddr: string = manifest.contracts.MockGaugeController.address;
  const matchboxAddr: string = manifest.contracts.MockMatchbox.address;

  const optimizerAbi = [
    "function TOTAL_BPS() view returns (uint256)",
    "function gaugeController() view returns (address)",
    "function matchbox() view returns (address)",
    "function owner() view returns (address)",
    "function keeper() view returns (address)",
  ];
  const gaugeControllerAbi = [
    "function gauges() view returns (address[])",
    "function gaugeCount() view returns (uint256)",
    "function gaugeMeta(address) view returns (string, uint256)",
  ];
  const matchboxAbi = ["function bribeForGauge(address) view returns (uint256)"];
  const veMezoAbi = ["function balanceOf(address) view returns (uint256)"];

  it("connects to the configured chain", async () => {
    const network = await provider.getNetwork();
    expect(Number(network.chainId)).to.equal(manifest.chainId);
    expect(manifest.chainId).to.equal(31611);
  });

  it("MezoYieldOptimizer's wiring matches the manifest", async () => {
    const c = new ethers.Contract(optimizerAddr, optimizerAbi, provider);
    expect(await c.TOTAL_BPS()).to.equal(10_000n);
    expect(await c.gaugeController()).to.equal(gaugeControllerAddr);
    expect(await c.matchbox()).to.equal(matchboxAddr);
    expect(await c.owner()).to.equal(manifest.deployer);
    expect(await c.keeper()).to.equal(manifest.deployer);
  });

  it("MockGaugeController's seeded gauges round-trip", async () => {
    const c = new ethers.Contract(gaugeControllerAddr, gaugeControllerAbi, provider);
    const onChain: string[] = await c.gauges();
    const seeded: { name: string; address: string }[] = manifest.seededGauges ?? [];
    expect(seeded.length).to.be.greaterThan(0);
    for (const g of seeded) {
      expect(onChain.map((a) => a.toLowerCase())).to.include(g.address.toLowerCase());
      const [name] = await c.gaugeMeta(g.address);
      expect(name).to.equal(g.name);
    }
    expect(Number(await c.gaugeCount())).to.equal(seeded.length);
  });

  it("MockMatchbox's seeded bribes match the manifest", async () => {
    const c = new ethers.Contract(matchboxAddr, matchboxAbi, provider);
    const seeded: { address: string; bribeMUSDWei: string }[] = manifest.seededGauges ?? [];
    for (const g of seeded) {
      const onChain: bigint = await c.bribeForGauge(g.address);
      expect(onChain.toString()).to.equal(g.bribeMUSDWei);
    }
  });

  it("MockVeMezo holds the deployer's seed balance", async () => {
    const veMezoAddr: string = manifest.contracts.MockVeMezo.address;
    const c = new ethers.Contract(veMezoAddr, veMezoAbi, provider);
    const onChain: bigint = await c.balanceOf(manifest.deployer);
    expect(onChain.toString()).to.equal(manifest.seedDeployerVeMezoWei);
  });
});
