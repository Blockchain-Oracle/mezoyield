import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

/**
 * STORY-003 deploy stub. Full deploy + JSON-emit + lib/contracts.ts wiring
 * lands in STORY-004 — see `context/docs/stories/story-004.md`. We keep this
 * minimal so the contracts package is runnable end-to-end (compile + test +
 * dry-run deploy on hardhat-network) without committing testnet artifacts
 * before STORY-004's BDD acceptance covers them.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name} (chainId ${network.config.chainId ?? "?"})`);
  console.log(`Deployer: ${deployer.address}`);

  // Mocks first — the real Mezo gauge/matchbox addresses aren't published
  // yet (CONTEXT.md OQ #6). Disclosed in TESTNET_ADDRESSES.md when STORY-004
  // ships.
  const GaugeControllerFactory = await ethers.getContractFactory("MockGaugeController");
  const gaugeController = await GaugeControllerFactory.deploy();
  await gaugeController.waitForDeployment();
  const gaugeControllerAddress = await gaugeController.getAddress();
  console.log(`MockGaugeController: ${gaugeControllerAddress}`);

  const MatchboxFactory = await ethers.getContractFactory("MockMatchbox");
  const matchbox = await MatchboxFactory.deploy();
  await matchbox.waitForDeployment();
  const matchboxAddress = await matchbox.getAddress();
  console.log(`MockMatchbox: ${matchboxAddress}`);

  const OptimizerFactory = await ethers.getContractFactory("MezoYieldOptimizer");
  const optimizer = await OptimizerFactory.deploy(
    gaugeControllerAddress,
    matchboxAddress,
    deployer.address, // initial keeper = deployer
  );
  await optimizer.waitForDeployment();
  const optimizerAddress = await optimizer.getAddress();
  console.log(`MezoYieldOptimizer: ${optimizerAddress}`);

  // STORY-004 will write deployments/mezo-testnet.json with full metadata
  // (txHashes, blockNumber, deployedAt) for the app to import. STORY-003's
  // local hardhat run doesn't need a committed artifact; emit a hint only
  // when on a non-hardhat network so it's obvious deploy was skipped.
  if (network.name !== "hardhat") {
    const dir = resolve(__dirname, "../deployments");
    if (!existsSync(dir)) mkdirSync(dir);
    const file = resolve(dir, `${network.name}.json`);
    const blockNumber = await ethers.provider.getBlockNumber();
    writeFileSync(
      file,
      JSON.stringify(
        {
          chainId: network.config.chainId,
          deployedAt: new Date().toISOString(),
          deployer: deployer.address,
          contracts: {
            optimizer: optimizerAddress,
            mockGaugeController: gaugeControllerAddress,
            mockMatchbox: matchboxAddress,
          },
          blockNumber,
          notes:
            "Mocks are stand-ins because Mezo's real gauge/matchbox addresses are not published. See TESTNET_ADDRESSES.md.",
        },
        null,
        2,
      ),
    );
    console.log(`Wrote ${file}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
