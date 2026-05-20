import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Hotfix: call setTrackedGauges on the live mainnet MatchboxAdapter.
 * Codex P1 on PR #44 — the matchbox-redeploy script seeded bribes but
 * never registered the tracked gauge list, so pending() and claim()
 * iterate an empty array.
 *
 * This script reads the 5 mainnet gauge addresses from the manifest's
 * curated list and registers them on the live MatchboxAdapter.
 */
const MANIFEST_PATH = resolve(__dirname, "..", "deployments", "mezo-mainnet.json");

const SEED_GAUGES = [
  "0x183277fd6b6b32cc788da5233fa960e044ad27b1",
  "0x6581d85d30f8dd05f80f35eeae425b8deb1f1e6f",
  "0xffdbbbed26a589fd3b6914804b48122290f5a32b",
  "0x337a50e99a7e50d398a6f0e1b449adab100802b3",
  "0x445204f63086cc36dc3af21b1695938f074cc66e",
];

async function main() {
  if (network.config.chainId !== 31612) {
    throw new Error(`Must run against Mezo Mainnet (31612).`);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const matchboxAddr = manifest.contracts.MockMatchbox.address as string;
  if (!matchboxAddr) throw new Error("MockMatchbox.address missing.");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer:        ${deployer.address}`);
  console.log(`MatchboxAdapter: ${matchboxAddr}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchbox: any = await ethers.getContractAt("MatchboxAdapter", matchboxAddr);
  const currentCount = await matchbox.trackedGaugesCount();
  console.log(`Current tracked count: ${currentCount}`);

  if (Number(currentCount) > 0) {
    console.log("Already registered — nothing to do.");
    return;
  }

  const tx = await matchbox.setTrackedGauges(SEED_GAUGES);
  await tx.wait();
  const newCount = await matchbox.trackedGaugesCount();
  console.log(`setTrackedGauges tx: ${tx.hash}`);
  console.log(`Tracked count after: ${newCount}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
