import { ethers, network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Single canonical redeploy for the BoostVoterAdapter + MezoYieldOptimizer
 * pair on Mezo Mainnet (chain 31612). Supersedes:
 *
 *   - deploy-mainnet.ts
 *   - deploy-mainnet-adapters.ts
 *   - redeploy-mainnet-adapter-fix.ts
 *   - redeploy-mainnet-matchbox-fix.ts
 *   - fix-mainnet-tracked-gauges.ts
 *
 * Why a new pair: the previous BoostVoterAdapter + Optimizer combination
 * had an architectural msg.sender bug — the optimizer (non-custodial)
 * called the adapter, the adapter checked balanceOf(msg.sender) for a
 * veMEZO NFT, and the optimizer holds none. Every keeper tick reverted
 * with CallerHasNoVeMezo. v3 introduces `voteForUser(voter, …)` on the
 * adapter and an enumerable `delegatedUsers[]` on the optimizer; the
 * optimizer fans out one tx into N per-user adapter calls. See
 * `packages/contracts/contracts/{adapters/BoostVoterAdapter,MezoYieldOptimizer}.sol`
 * for the full change set.
 *
 * What this script does:
 *   1. Deploy a fresh BoostVoterAdapter wired to the real Mezo BoostVoter
 *      + real veMEZO (read from manifest `external`).
 *   2. Register the 5 known gauges (preserving the existing MatchboxAdapter
 *      v3's tracked-gauge set, so the keeper's gauge list stays consistent
 *      across the read + claim surfaces).
 *   3. Deploy a fresh MezoYieldOptimizer wired to the new adapter + the
 *      existing MatchboxAdapter v3 + the keeper EOA.
 *   4. Call `adapter.setOptimizer(optimizer.address)` so the adapter
 *      accepts `voteForUser` calls from the new optimizer.
 *   5. Patch the manifest in place:
 *      - `contracts.MezoYieldOptimizer.{address,txHash,blockNumber}` ←
 *        new optimizer
 *      - `contracts.MockGaugeController.{address,txHash,blockNumber}` ←
 *        new BoostVoterAdapter
 *      - `contracts.MockMatchbox`            ← UNCHANGED (MatchboxAdapter
 *                                              v3 already has tracked
 *                                              gauges + bribe cache; we
 *                                              keep that state)
 *      - `contracts.MockVeMezo`              ← UNCHANGED (VeMezoVotingPower
 *                                              read-only shim is correct)
 *      - `deployedAt`                        ← bumped to ISO timestamp
 *
 * Refuses to run when:
 *   - Network is not mezoMainnet (chain 31612).
 *   - The committed `external.MezoBoostVoter` / `external.VeMEZO` are
 *     missing.
 *   - The existing MatchboxAdapter / VeMezoVotingPower addresses are
 *     missing (we don't redeploy those — we preserve their state).
 */
const MANIFEST_PATH = resolve(__dirname, "..", "deployments", "mezo-mainnet.json");

// Canonical 5-gauge set, identical to the existing MatchboxAdapter v3
// `trackedGauges` and the prior BoostVoterAdapter v2 registry. Keeping
// the same set means the keeper's `loadGauges` output is unchanged
// across the redeploy. Weights are placeholders (the off-chain keeper
// computes optimal allocation from MatchboxAdapter.bribeForGauge, not
// these stored totals).
const TRACKED_GAUGES = [
  { addr: "0x183277fd6B6B32CC788dA5233fa960E044AD27B1", name: "Mezo Gauge 0", weight: 1_000_000n * 10n ** 18n },
  { addr: "0x6581d85d30f8dd05f80F35EeAe425b8Deb1f1E6F", name: "Mezo Gauge 1", weight: 1_000_000n * 10n ** 18n },
  { addr: "0xfFDBbbED26a589fd3b6914804b48122290F5a32b", name: "Mezo Gauge 2", weight: 1_000_000n * 10n ** 18n },
  { addr: "0x337A50E99a7e50D398A6F0E1B449AdAb100802b3", name: "Mezo Gauge 3", weight: 1_000_000n * 10n ** 18n },
  { addr: "0x445204f63086cC36dC3af21b1695938F074cc66e", name: "Mezo Gauge 4", weight: 1_000_000n * 10n ** 18n },
];

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
      `redeploy-mainnet-canonical.ts must run against Mezo Mainnet (31612). ` +
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
  if (!boostVoter || !veMezoUpstream) {
    throw new Error(
      "mezo-mainnet.json `external` block missing MezoBoostVoter / VeMEZO.",
    );
  }

  const existingMatchboxAddr = manifest.contracts.MockMatchbox.address;
  const existingVotingPowerAddr = manifest.contracts.MockVeMezo.address;
  if (!existingMatchboxAddr || !existingVotingPowerAddr) {
    throw new Error(
      "mezo-mainnet.json missing MockMatchbox or MockVeMezo address — " +
        "this script preserves those contracts and only redeploys " +
        "BoostVoterAdapter + Optimizer. If MatchboxAdapter / " +
        "VeMezoVotingPower truly need redeployment, run " +
        "deploy-mainnet-adapters.ts first.",
    );
  }

  const head = await ethers.provider.getBlockNumber();
  console.log(`Network:                ${network.name} (chain ${network.config.chainId})`);
  console.log(`Head block:             ${head}`);
  console.log(`Deployer:               ${deployer.address}`);
  console.log(`BoostVoter (upstream):  ${boostVoter}`);
  console.log(`VeMEZO (upstream):      ${veMezoUpstream}`);
  console.log(`MatchboxAdapter (keep): ${existingMatchboxAddr}`);
  console.log(`VotingPower (keep):     ${existingVotingPowerAddr}`);
  console.log("");

  // ─── 1. Deploy new BoostVoterAdapter ────────────────────────────
  console.log("[1/4] Deploying BoostVoterAdapter…");
  const AdapterFactory = await ethers.getContractFactory("BoostVoterAdapter");
  const adapter = await AdapterFactory.deploy(boostVoter, veMezoUpstream);
  const adapterTx = adapter.deploymentTransaction();
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  const adapterBlock = adapterTx ? (await adapterTx.wait())?.blockNumber ?? null : null;
  console.log(`  → ${adapterAddr}  (tx ${adapterTx?.hash}, block ${adapterBlock})`);

  // ─── 2. Register the 5 known gauges ─────────────────────────────
  console.log("[2/4] Registering 5 tracked gauges…");
  const gaugeAddrs = TRACKED_GAUGES.map((g) => g.addr);
  const gaugeNames = TRACKED_GAUGES.map((g) => g.name);
  const gaugeWeights = TRACKED_GAUGES.map((g) => g.weight);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regTx = await (adapter as any).registerGauges(gaugeAddrs, gaugeNames, gaugeWeights);
  await regTx.wait();
  console.log(`  → tx ${regTx.hash}`);

  // ─── 3. Deploy new MezoYieldOptimizer ───────────────────────────
  console.log("[3/4] Deploying MezoYieldOptimizer…");
  const OptimizerFactory = await ethers.getContractFactory("MezoYieldOptimizer");
  const optimizer = await OptimizerFactory.deploy(
    adapterAddr,
    existingMatchboxAddr,
    deployer.address,
  );
  const optTx = optimizer.deploymentTransaction();
  await optimizer.waitForDeployment();
  const optAddr = await optimizer.getAddress();
  const optBlock = optTx ? (await optTx.wait())?.blockNumber ?? null : null;
  console.log(`  → ${optAddr}  (tx ${optTx?.hash}, block ${optBlock})`);

  // ─── 4. Wire optimizer slot on adapter ──────────────────────────
  console.log("[4/4] Wiring adapter.setOptimizer(optimizer)…");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wireTx = await (adapter as any).setOptimizer(optAddr);
  await wireTx.wait();
  console.log(`  → tx ${wireTx.hash}`);

  // ─── Patch manifest ─────────────────────────────────────────────
  manifest.contracts.MezoYieldOptimizer = {
    address: optAddr,
    txHash: optTx?.hash ?? null,
    blockNumber: optBlock,
  };
  manifest.contracts.MockGaugeController = {
    address: adapterAddr,
    txHash: adapterTx?.hash ?? null,
    blockNumber: adapterBlock,
  };
  // MockMatchbox + MockVeMezo intentionally left untouched.
  manifest.deployedAt = new Date().toISOString();
  manifest.deployer = deployer.address;
  saveManifest(manifest);

  console.log("");
  console.log("─".repeat(60));
  console.log("Manifest updated. New canonical addresses:");
  console.log(`  MezoYieldOptimizer:   ${optAddr}`);
  console.log(`  BoostVoterAdapter:    ${adapterAddr}`);
  console.log("Preserved (no redeploy):");
  console.log(`  MatchboxAdapter:      ${existingMatchboxAddr}`);
  console.log(`  VeMezoVotingPower:    ${existingVotingPowerAddr}`);
  console.log("─".repeat(60));
  console.log("");
  console.log("Next steps:");
  console.log("  1. Commit deployments/mezo-mainnet.json + push to main.");
  console.log("  2. From keeper EOA: lock MEZO (veMEZO.createLock(amount, 604800)).");
  console.log("  3. From keeper EOA: veMEZO.setApprovalForAll(BoostVoterAdapter, true).");
  console.log("  4. Force-redeploy Coolify mainnet app + keeper.");
  console.log("  5. Restart keeper container to fire boot tick.");
  console.log("  6. Run scripts/verify-mainnet-state.ts to confirm.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
