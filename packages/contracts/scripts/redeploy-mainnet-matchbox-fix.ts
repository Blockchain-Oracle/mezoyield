import { ethers, network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Round-2 redeploy: replaces MatchboxAdapter v1 (missing `bribeForGauge`)
 * with v2. Caught by running the keeper locally — its `loadGauges` call
 * reads `Matchbox.bribeForGauge(gauge)` per registered gauge, and v1
 * didn't expose that getter. v2 stores per-gauge bribe in MUSD wei,
 * settable by owner via `setBribesForGauges([], [])`.
 *
 * Then re-deploys MezoYieldOptimizer (immutable matchbox pointer) and
 * merges the new addresses. Keeps the v2 BoostVoterAdapter and
 * VeMezoVotingPower in place — they're unchanged.
 *
 * Finally seeds bribe values for the 5 registered gauges so the keeper's
 * boot tick has scoring data right away.
 */
const MANIFEST_PATH = resolve(__dirname, "..", "deployments", "mezo-mainnet.json");

// Same 5 gauges registered on the new BoostVoterAdapter, with realistic
// bribe MUSD amounts (modest figures for the demo — keeper will pick the
// highest-scoring one each epoch).
const GAUGE_BRIBES: Array<{ address: string; bribeMUSD: bigint }> = [
  { address: "0x183277fd6b6b32cc788da5233fa960e044ad27b1", bribeMUSD: 8_400n * 10n ** 18n },
  { address: "0x6581d85d30f8dd05f80f35eeae425b8deb1f1e6f", bribeMUSD: 4_500n * 10n ** 18n },
  { address: "0xffdbbbed26a589fd3b6914804b48122290f5a32b", bribeMUSD: 5_200n * 10n ** 18n },
  { address: "0x337a50e99a7e50d398a6f0e1b449adab100802b3", bribeMUSD: 2_100n * 10n ** 18n },
  { address: "0x445204f63086cc36dc3af21b1695938f074cc66e", bribeMUSD: 3_800n * 10n ** 18n },
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
  if (!ext.MezoBoostVoter || !ext.VeMEZO || !ext.MUSD) {
    throw new Error("mezo-mainnet.json external missing required addresses.");
  }
  const gaugeController = manifest.contracts.MockGaugeController.address;
  if (!gaugeController) throw new Error("MockGaugeController.address missing — run the BoostVoterAdapter deploy first.");

  console.log(`Deployer:           ${deployer.address}`);
  console.log(`BoostVoterAdapter:  ${gaugeController}  (kept)`);
  console.log(`VeMezoVotingPower:  ${manifest.contracts.MockVeMezo.address}  (kept)`);

  // 1) Deploy new MatchboxAdapter.
  const MatchboxFactory = await ethers.getContractFactory("MatchboxAdapter");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchbox: any = await MatchboxFactory.deploy(ext.MezoBoostVoter, ext.VeMEZO, ext.MUSD);
  const matchboxTx = matchbox.deploymentTransaction();
  await matchbox.waitForDeployment();
  const matchboxAddr = await matchbox.getAddress();
  const matchboxBlock = matchboxTx ? (await matchboxTx.wait())?.blockNumber ?? null : null;
  console.log(`\nNew MatchboxAdapter:    ${matchboxAddr}  (tx ${matchboxTx?.hash}, block ${matchboxBlock})`);

  // 2a) Register tracked gauges — claim/pending iterate this list.
  // Codex P1 on the first version of this script omitted this step,
  // leaving the deployed matchbox unable to enumerate gauges for
  // claims. Always register the tracked set BEFORE setting bribes so
  // both reads and writes have data on first run.
  const gaugeAddrs = GAUGE_BRIBES.map((g) => g.address);
  const trackTx = await matchbox.setTrackedGauges(gaugeAddrs);
  await trackTx.wait();
  console.log(`Registered ${gaugeAddrs.length} tracked gauges (tx ${trackTx.hash})`);

  // 2b) Seed bribes for the same 5 registered gauges.
  const bribeAmounts = GAUGE_BRIBES.map((g) => g.bribeMUSD);
  const setTx = await matchbox.setBribesForGauges(gaugeAddrs, bribeAmounts);
  await setTx.wait();
  console.log(`Seeded ${GAUGE_BRIBES.length} gauge bribes (tx ${setTx.hash})`);

  // 3) Redeploy MezoYieldOptimizer (matchbox is immutable).
  const OptimizerFactory = await ethers.getContractFactory("MezoYieldOptimizer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optimizer: any = await OptimizerFactory.deploy(gaugeController, matchboxAddr, deployer.address);
  const optTx = optimizer.deploymentTransaction();
  await optimizer.waitForDeployment();
  const optAddr = await optimizer.getAddress();
  const optBlock = optTx ? (await optTx.wait())?.blockNumber ?? null : null;
  console.log(`New MezoYieldOptimizer: ${optAddr}  (tx ${optTx?.hash}, block ${optBlock})`);

  // 4) Merge into manifest.
  manifest.contracts.MockMatchbox = {
    address: matchboxAddr,
    txHash: matchboxTx?.hash ?? null,
    blockNumber: matchboxBlock,
  };
  manifest.contracts.MezoYieldOptimizer = {
    address: optAddr,
    txHash: optTx?.hash ?? null,
    blockNumber: optBlock,
  };
  manifest.deployedAt = new Date().toISOString();
  manifest.deployer = deployer.address;
  saveManifest(manifest);

  console.log(`\nManifest updated. Verify keeper:`);
  console.log(`  cd packages/keeper && env MEZO_NETWORK=mainnet KEEPER_RPC_URL=https://rpc-http.mezo.boar.network ...`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
