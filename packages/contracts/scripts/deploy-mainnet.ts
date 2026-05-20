import { ethers, network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Mainnet-specific deploy script. Reads the curated `mezo-mainnet.json`
 * manifest (real BoostVoter / veMEZO / MUSD addresses verified live via
 * the `veMEZO.voter()` reverse lookup), deploys ONLY `MezoYieldOptimizer`
 * wired to those addresses, and MERGES the new Optimizer address into
 * the manifest — preserving every other field.
 *
 * What this script does NOT do (by design):
 *   - It does NOT deploy `MockGaugeController`, `MockMatchbox`, or
 *     `MockVeMezo`. Those are testnet-only fixtures. On mainnet the
 *     equivalents are real Mezo contracts already on-chain.
 *   - It does NOT seed gauges or bribes. Real gauges exist on the
 *     Mezo BoostVoter; we don't write to them.
 *   - It does NOT overwrite the manifest from scratch. The committed
 *     external addresses are the source of truth; we patch in the
 *     Optimizer address and leave everything else alone.
 *
 * Refuses to run when:
 *   - The current Hardhat network is not `mezoMainnet` (chainId 31612).
 *     A misconfigured invocation against testnet would corrupt the
 *     testnet manifest.
 *   - `MockGaugeController.address` is missing from the mainnet
 *     manifest. Without a gauge controller the Optimizer has nothing
 *     to vote against.
 *   - `MockMatchbox.address` is missing from the mainnet manifest.
 *     The Optimizer's `claimRewards` flow forwards to whichever
 *     address is wired as the matchbox. On Mezo mainnet the bribe
 *     market is per-gauge (BribeVotingReward children of the Voter),
 *     so the manifest must carry a deployed Matchbox-shaped adapter
 *     address. Phase 3 of the mainnet rollout writes a thin adapter
 *     contract and commits its address; until then this script
 *     refuses to deploy a half-wired Optimizer.
 *
 * Naming note: the manifest keys are `MockGaugeController` and
 * `MockMatchbox` for shape compatibility with the testnet manifest.
 * On mainnet those slots carry REAL addresses. A future rename PR
 * will normalize the names across both manifests + all consumers.
 */
const MANIFEST_PATH = resolve(
  __dirname,
  "..",
  "deployments",
  "mezo-mainnet.json",
);

type DeployedContract = {
  address: string | null;
  txHash: string | null;
  blockNumber: number | null;
};

type Manifest = {
  chainId: number;
  network: string;
  rpcUrl: string;
  explorer?: string;
  deployer: string;
  deployedAt: string | null;
  contracts: {
    MezoYieldOptimizer: DeployedContract;
    MockGaugeController: DeployedContract;
    MockMatchbox: DeployedContract;
    MockVeMezo: DeployedContract;
  };
  external?: Record<string, string>;
  seedDeployerVeMezoWei: string;
  seedDeployerPendingMUSDWei: string;
  seededGauges: unknown[];
  notes: string;
};

function loadManifest(): Manifest {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as Manifest;
}

function saveManifest(manifest: Manifest) {
  // Indent to match the existing format so the diff stays small.
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(
      `deploy-mainnet.ts must run against Mezo Mainnet (chainId 31612). ` +
        `Current network: ${network.name} (chainId ${network.config.chainId ?? "?"}). ` +
        `Use \`pnpm --filter @mezoyield/contracts run deploy:testnet\` for testnet.`,
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer. Set MAINNET_DEPLOYER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY as fallback) in packages/contracts/.env.",
    );
  }

  const manifest = loadManifest();

  const gaugeController = manifest.contracts.MockGaugeController.address;
  if (!gaugeController) {
    throw new Error(
      "MockGaugeController.address missing from mezo-mainnet.json. The real " +
        "Mezo BoostVoter (external.MezoBoostVoter) speaks a different ABI than " +
        "`IGaugeController`, so the optimizer can't be wired to it directly. " +
        "Phase 3 of the mainnet rollout deploys a `BoostVoterAdapter` and " +
        "writes its address into this slot.",
    );
  }

  const matchbox = manifest.contracts.MockMatchbox.address;
  if (!matchbox) {
    throw new Error(
      "MockMatchbox.address missing from mezo-mainnet.json. Mezo mainnet's " +
        "bribe market is per-gauge (BribeVotingReward children of the Voter), " +
        "not a singleton matchbox. Phase 3 deploys a `MatchboxAdapter` that " +
        "multiplexes per-gauge claims and writes its address into this slot.",
    );
  }

  const veMezo = manifest.contracts.MockVeMezo.address;
  if (!veMezo) {
    throw new Error(
      "MockVeMezo.address missing from mezo-mainnet.json. The real Mezo " +
        "veMEZO is an ERC-721 NFT (external.VeMEZO) — `balanceOf(user)` " +
        "returns NFT count, not voting-power weight. Phase 3 deploys a " +
        "`VeMezoVotingPower` shim that reads voting power across all of " +
        "the user's lock NFTs and writes its address into this slot.",
    );
  }

  console.log(`Network:        ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer EOA:   ${deployer.address}`);
  console.log(`GaugeController: ${gaugeController}  (BoostVoter proxy)`);
  console.log(`Matchbox:        ${matchbox}`);
  console.log(`Keeper:          ${deployer.address}  (deployer doubles as keeper)`);

  // -------- Deploy Optimizer (and ONLY Optimizer) --------

  const OptimizerFactory = await ethers.getContractFactory("MezoYieldOptimizer");
  const optimizer = await OptimizerFactory.deploy(
    gaugeController,
    matchbox,
    deployer.address,
  );
  const optimizerTx = optimizer.deploymentTransaction();
  await optimizer.waitForDeployment();
  const optimizerAddress = await optimizer.getAddress();
  const optimizerBlock = optimizerTx
    ? (await optimizerTx.wait())?.blockNumber ?? null
    : null;

  console.log(`MezoYieldOptimizer deployed: ${optimizerAddress}`);
  console.log(`  txHash:   ${optimizerTx?.hash ?? "?"}`);
  console.log(`  block:    ${optimizerBlock ?? "?"}`);

  // -------- Merge into manifest (don't overwrite external addresses) --------

  manifest.contracts.MezoYieldOptimizer = {
    address: optimizerAddress,
    txHash: optimizerTx?.hash ?? null,
    blockNumber: optimizerBlock,
  };
  manifest.deployedAt = new Date().toISOString();
  manifest.deployer = deployer.address;

  saveManifest(manifest);

  console.log(`\nManifest updated: ${MANIFEST_PATH}`);
  console.log(`Commit the change to land the mainnet app/keeper build.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
