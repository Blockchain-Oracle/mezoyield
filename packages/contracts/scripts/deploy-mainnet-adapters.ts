import { ethers, network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Deploys the three Mezo mainnet adapters (issue #31) and writes their
 * addresses into `mezo-mainnet.json`'s Mock* slots:
 *
 *   - BoostVoterAdapter → MockGaugeController.address
 *   - MatchboxAdapter   → MockMatchbox.address
 *   - VeMezoVotingPower → MockVeMezo.address
 *
 * The naming preserves shape compatibility with the testnet manifest
 * (a future rename PR will normalize the keys across both networks +
 * every consumer).
 *
 * After this script runs and the manifest is committed, the
 * `MezoYieldOptimizer not yet deployed` fail-fast in `lib/contracts.ts`
 * still blocks builds (Optimizer is still null) — but the next deploy
 * (`deploy-mainnet.ts`, issue #34) can now succeed because every
 * required adapter address is populated.
 *
 * Refuses to run when:
 *   - Not on Mezo Mainnet (chain 31612).
 *   - The committed `external.MezoBoostVoter`, `external.VeMEZO`,
 *     `external.MUSD` fields are missing — those are the upstream
 *     contracts the adapters wrap.
 *
 * After deploy:
 *   - Calls `MatchboxAdapter.setTrackedGauges(gaugeList)` with the
 *     gauge list passed in via env var `MAINNET_TRACKED_GAUGES`
 *     (comma-separated). Skip the call when the env is unset — the
 *     matchbox can be populated post-deploy.
 *   - Transfers ownership of the MatchboxAdapter to the
 *     MAINNET_MATCHBOX_OWNER env var if set, otherwise leaves it at
 *     the deployer EOA.
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
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

function saveManifest(m: Manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + "\n", "utf8");
}

async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(
      `deploy-mainnet-adapters.ts must run against Mezo Mainnet (31612). ` +
        `Current: ${network.name} (${network.config.chainId ?? "?"}).`,
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer. Set MAINNET_DEPLOYER_PRIVATE_KEY in packages/contracts/.env.",
    );
  }

  const manifest = loadManifest();
  const ext = manifest.external ?? {};
  const boostVoter = ext.MezoBoostVoter;
  const veMezoUpstream = ext.VeMEZO;
  const musd = ext.MUSD;

  if (!boostVoter || !veMezoUpstream || !musd) {
    throw new Error(
      "mezo-mainnet.json `external` block missing MezoBoostVoter / VeMEZO / MUSD. " +
        "These addresses must be populated before adapters can deploy.",
    );
  }

  console.log(`Deployer:        ${deployer.address}`);
  console.log(`BoostVoter:      ${boostVoter}`);
  console.log(`VeMEZO:          ${veMezoUpstream}`);
  console.log(`MUSD:            ${musd}`);

  // ─── BoostVoterAdapter ───────────────────────────────────────
  const BoostFactory = await ethers.getContractFactory("BoostVoterAdapter");
  const boostAdapter = await BoostFactory.deploy(boostVoter, veMezoUpstream);
  const boostTx = boostAdapter.deploymentTransaction();
  await boostAdapter.waitForDeployment();
  const boostAddr = await boostAdapter.getAddress();
  const boostBlock = boostTx ? (await boostTx.wait())?.blockNumber ?? null : null;
  console.log(`BoostVoterAdapter:    ${boostAddr}  (tx ${boostTx?.hash})`);

  // ─── VeMezoVotingPower ───────────────────────────────────────
  const PowerFactory = await ethers.getContractFactory("VeMezoVotingPower");
  const powerAdapter = await PowerFactory.deploy(veMezoUpstream);
  const powerTx = powerAdapter.deploymentTransaction();
  await powerAdapter.waitForDeployment();
  const powerAddr = await powerAdapter.getAddress();
  const powerBlock = powerTx ? (await powerTx.wait())?.blockNumber ?? null : null;
  console.log(`VeMezoVotingPower:    ${powerAddr}  (tx ${powerTx?.hash})`);

  // ─── MatchboxAdapter ─────────────────────────────────────────
  const MatchboxFactory = await ethers.getContractFactory("MatchboxAdapter");
  const matchboxAdapter = await MatchboxFactory.deploy(
    boostVoter,
    veMezoUpstream,
    musd,
  );
  const matchboxTx = matchboxAdapter.deploymentTransaction();
  await matchboxAdapter.waitForDeployment();
  const matchboxAddr = await matchboxAdapter.getAddress();
  const matchboxBlock = matchboxTx
    ? (await matchboxTx.wait())?.blockNumber ?? null
    : null;
  console.log(`MatchboxAdapter:      ${matchboxAddr}  (tx ${matchboxTx?.hash})`);

  // Optional tracked-gauge registration.
  const trackedEnv = process.env.MAINNET_TRACKED_GAUGES;
  if (trackedEnv) {
    const gaugeList = trackedEnv
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    console.log(`Registering ${gaugeList.length} tracked gauge(s)…`);
    const setTx = await matchboxAdapter.setTrackedGauges(gaugeList);
    await setTx.wait();
    console.log(`  setTrackedGauges tx ${setTx.hash}`);
  } else {
    console.log(
      "MAINNET_TRACKED_GAUGES unset — Matchbox starts with empty gauge list. " +
        "Register later via matchboxAdapter.setTrackedGauges(...).",
    );
  }

  // Optional owner transfer.
  const newOwner = process.env.MAINNET_MATCHBOX_OWNER;
  if (newOwner && newOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(`Transferring Matchbox ownership to ${newOwner}…`);
    const tx = await matchboxAdapter.transferOwnership(newOwner);
    await tx.wait();
    console.log(`  transferOwnership tx ${tx.hash}`);
  }

  // ─── Merge into manifest ─────────────────────────────────────
  manifest.contracts.MockGaugeController = {
    address: boostAddr,
    txHash: boostTx?.hash ?? null,
    blockNumber: boostBlock,
  };
  manifest.contracts.MockVeMezo = {
    address: powerAddr,
    txHash: powerTx?.hash ?? null,
    blockNumber: powerBlock,
  };
  manifest.contracts.MockMatchbox = {
    address: matchboxAddr,
    txHash: matchboxTx?.hash ?? null,
    blockNumber: matchboxBlock,
  };
  manifest.deployer = deployer.address;
  saveManifest(manifest);

  console.log(`\nManifest updated: ${MANIFEST_PATH}`);
  console.log(`Optimizer.address is still null — run deploy-mainnet.ts next.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
