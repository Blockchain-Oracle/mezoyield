import { ethers } from "hardhat";

/**
 * Quick probe of Mezo BoostVoter to dump real gauge addresses + check
 * what we can actually call from a freshly-deployed adapter. Run via:
 *   pnpm --filter @mezoyield/contracts exec hardhat run \
 *     scripts/probe-boostvoter.ts --network mezoMainnet
 */
async function main() {
  const provider = ethers.provider;
  const boostVoter = "0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1";
  const c = new ethers.Contract(
    boostVoter,
    [
      "function length() view returns (uint256)",
      "function gauges(uint256) view returns (address)",
      "function isGauge(address) view returns (bool)",
      "function gaugeToBribe(address) view returns (address)",
      "function votes(uint256, address) view returns (uint256)",
    ],
    provider,
  );

  const len = await c.length();
  console.log(`gauges length: ${len}`);

  // Try a few indexes.
  const sampleIndexes = [0n, 1n, 2n, 10n, 100n, len - 1n];
  console.log("\nSample gauges:");
  for (const i of sampleIndexes) {
    try {
      const g = await c.gauges(i);
      const isG = await c.isGauge(g);
      const bribe = await c.gaugeToBribe(g);
      console.log(`  [${i}] ${g}  isGauge=${isG}  bribe=${bribe}`);
    } catch (err: any) {
      console.log(`  [${i}] revert: ${err.shortMessage ?? err.message?.slice(0, 80)}`);
    }
  }

  // Check our manifest gauge addresses against isGauge.
  console.log("\nManifest 'gauges' against isGauge():");
  const manifestGauges = [
    "0x183277fd6B6B32CC788dA5233fa960E044AD27B1",
    "0x6581d85d30f8dd05f80F35EeAe425b8Deb1f1E6F",
    "0xfFDBbbED26a589fd3b6914804b48122290F5a32b",
    "0x337A50E99a7e50D398A6F0E1B449AdAb100802b3",
    "0x445204f63086cC36dC3af21b1695938F074cc66e",
  ];
  for (const g of manifestGauges) {
    try {
      const isG = await c.isGauge(g);
      console.log(`  ${g}: isGauge=${isG}`);
    } catch (err: any) {
      console.log(`  ${g}: revert ${err.shortMessage ?? err.message?.slice(0, 60)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
