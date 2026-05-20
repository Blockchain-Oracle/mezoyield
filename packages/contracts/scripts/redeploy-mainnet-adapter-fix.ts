import { ethers, network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * One-shot redeploy to fix the v1 BoostVoterAdapter that lacked the
 * `gauges()` / `gaugeMeta()` read surface. The keeper crashed on its
 * first boot tick because every consumer (`useGaugeData`,
 * `useProtocolStrategyMix`, `computeOptimalAllocation`) calls those
 * reads, and the v1 adapter only implemented `voteForGaugeWeights`.
 *
 * This script:
 *   1. Deploys the new BoostVoterAdapter (v2 — with the registry).
 *   2. Deploys a new MezoYieldOptimizer wired to the new adapter
 *      (necessary because Optimizer's `gaugeController` is immutable).
 *   3. Registers a curated list of live Mezo BoostVoter gauges so the
 *      keeper has something to vote on right out of the gate.
 *   4. Merges the new addresses into mezo-mainnet.json — does NOT
 *      touch the Matchbox or VeMezoVotingPower entries (those still
 *      work because they don't need this fix).
 */
const MANIFEST_PATH = resolve(__dirname, "..", "deployments", "mezo-mainnet.json");

// First 5 live Mezo BoostVoter gauges (enumerated 2026-05-20 via
// `BoostVoter.gauges(0..4)`). Placeholder names because individual
// gauge contracts don't expose `name()` directly — the keeper / app
// renders these as-is until a name-resolution PR lands.
const SEED_GAUGES: Array<{ address: string; name: string; totalVeMezo: bigint }> = [
  { address: "0x183277fd6b6b32cc788da5233fa960e044ad27b1", name: "Mezo Gauge 0", totalVeMezo: 1_000_000n * 10n ** 18n },
  { address: "0x6581d85d30f8dd05f80f35eeae425b8deb1f1e6f", name: "Mezo Gauge 1", totalVeMezo: 1_000_000n * 10n ** 18n },
  { address: "0xffdbbbed26a589fd3b6914804b48122290f5a32b", name: "Mezo Gauge 2", totalVeMezo: 1_000_000n * 10n ** 18n },
  { address: "0x337a50e99a7e50d398a6f0e1b449adab100802b3", name: "Mezo Gauge 3", totalVeMezo: 1_000_000n * 10n ** 18n },
  { address: "0x445204f63086cc36dc3af21b1695938f074cc66e", name: "Mezo Gauge 4", totalVeMezo: 1_000_000n * 10n ** 18n },
];

type Manifest = {
  chainId: number;
  network: string;
  rpcUrl: string;
  explorer?: string;
  deployer: string;
  deployedAt: string | null;
  contracts: Record<string, { address: string | null; txHash: string | null; blockNumber: number | null }>;
  external?: Record<string, string>;
  seedDeployerVeMezoWei: string;
  seedDeployerPendingMUSDWei: string;
  seededGauges: unknown[];
  notes: string;
};

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}
function saveManifest(m: Manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + "\n", "utf8");
}

async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(`Must run against Mezo Mainnet (31612). Current: ${network.config.chainId}.`);
  }
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer signer.");

  const manifest = loadManifest();
  const ext = manifest.external ?? {};
  if (!ext.MezoBoostVoter || !ext.VeMEZO) {
    throw new Error("mezo-mainnet.json external block missing MezoBoostVoter or VeMEZO.");
  }

  console.log(`Deployer:        ${deployer.address}`);
  console.log(`BoostVoter:      ${ext.MezoBoostVoter}`);
  console.log(`VeMEZO:          ${ext.VeMEZO}`);
  console.log(`Existing Matchbox (kept):  ${manifest.contracts.MockMatchbox.address}`);
  console.log(`Existing VotingPower (kept): ${manifest.contracts.MockVeMezo.address}`);

  // 1) Deploy new BoostVoterAdapter (v2 with registry + reads).
  const AdapterFactory = await ethers.getContractFactory("BoostVoterAdapter");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter: any = await AdapterFactory.deploy(ext.MezoBoostVoter, ext.VeMEZO);
  const adapterTx = adapter.deploymentTransaction();
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  const adapterBlock = adapterTx ? (await adapterTx.wait())?.blockNumber ?? null : null;
  console.log(`\nNew BoostVoterAdapter: ${adapterAddr}  (tx ${adapterTx?.hash}, block ${adapterBlock})`);

  // 2) Register the seed gauges.
  const gaugeAddrs = SEED_GAUGES.map((g) => g.address);
  const gaugeNames = SEED_GAUGES.map((g) => g.name);
  const gaugeTotals = SEED_GAUGES.map((g) => g.totalVeMezo);
  const regTx = await adapter.registerGauges(gaugeAddrs, gaugeNames, gaugeTotals);
  await regTx.wait();
  console.log(`Registered ${SEED_GAUGES.length} gauges (tx ${regTx.hash})`);

  // 3) Deploy new MezoYieldOptimizer wired to new adapter.
  const matchbox = manifest.contracts.MockMatchbox.address;
  if (!matchbox) throw new Error("MockMatchbox.address missing.");
  const OptimizerFactory = await ethers.getContractFactory("MezoYieldOptimizer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optimizer: any = await OptimizerFactory.deploy(adapterAddr, matchbox, deployer.address);
  const optTx = optimizer.deploymentTransaction();
  await optimizer.waitForDeployment();
  const optAddr = await optimizer.getAddress();
  const optBlock = optTx ? (await optTx.wait())?.blockNumber ?? null : null;
  console.log(`New MezoYieldOptimizer: ${optAddr}  (tx ${optTx?.hash}, block ${optBlock})`);

  // 4) Merge into manifest.
  manifest.contracts.MockGaugeController = {
    address: adapterAddr,
    txHash: adapterTx?.hash ?? null,
    blockNumber: adapterBlock,
  };
  manifest.contracts.MezoYieldOptimizer = {
    address: optAddr,
    txHash: optTx?.hash ?? null,
    blockNumber: optBlock,
  };
  manifest.deployedAt = new Date().toISOString();
  manifest.deployer = deployer.address;
  saveManifest(manifest);

  console.log(`\nManifest updated. Verify keeper locally before pushing:`);
  console.log(`  MEZO_NETWORK=mainnet pnpm --filter @mezoyield/keeper run start`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
