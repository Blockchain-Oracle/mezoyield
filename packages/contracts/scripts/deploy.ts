import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

/**
 * Deploys MockGaugeController, MockMatchbox, MezoYieldOptimizer to the
 * configured network and writes a canonical deployments JSON
 * (`deployments/mezo-testnet.json` for Mezo Testnet) that the app side
 * imports via `packages/app/lib/contracts.ts`.
 *
 * Mocks ride along because Mezo hasn't published canonical gauge/matchbox
 * addresses (CONTEXT.md OQ #6); see the JSON's `notes` and the project
 * `TESTNET_ADDRESSES.md` for the disclosure. STORY-005+ will introduce a
 * Tigris (`mezo-org/tigris`'s Voter.sol) adapter when subgraph data lands.
 *
 * Slug map (network name → file name) matches story-004 spec which uses
 * kebab-case (mezo-testnet.json) regardless of the camelCase Hardhat
 * network name (mezoTestnet).
 */
const NETWORK_FILENAMES: Record<string, string> = {
  mezoTestnet: "mezo-testnet.json",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer. Set DEPLOYER_PRIVATE_KEY in packages/contracts/.env (see .env.example).",
    );
  }
  const chainIdRaw = network.config.chainId;
  console.log(`Network: ${network.name} (chainId ${chainIdRaw ?? "?"})`);
  console.log(`Deployer: ${deployer.address}`);

  const GaugeFactory = await ethers.getContractFactory("MockGaugeController");
  const gaugeController = await GaugeFactory.deploy();
  const gaugeControllerTx = gaugeController.deploymentTransaction();
  await gaugeController.waitForDeployment();
  const gaugeControllerAddress = await gaugeController.getAddress();
  console.log(`MockGaugeController: ${gaugeControllerAddress}`);

  const MatchboxFactory = await ethers.getContractFactory("MockMatchbox");
  const matchbox = await MatchboxFactory.deploy();
  const matchboxTx = matchbox.deploymentTransaction();
  await matchbox.waitForDeployment();
  const matchboxAddress = await matchbox.getAddress();
  console.log(`MockMatchbox: ${matchboxAddress}`);

  const OptimizerFactory = await ethers.getContractFactory("MezoYieldOptimizer");
  const optimizer = await OptimizerFactory.deploy(
    gaugeControllerAddress,
    matchboxAddress,
    deployer.address, // initial keeper = deployer
  );
  const optimizerTx = optimizer.deploymentTransaction();
  await optimizer.waitForDeployment();
  const optimizerAddress = await optimizer.getAddress();
  console.log(`MezoYieldOptimizer: ${optimizerAddress}`);

  if (network.name === "hardhat") {
    console.log("(hardhat-network: ephemeral; skipping JSON emit)");
    return;
  }

  const filename = NETWORK_FILENAMES[network.name] ?? `${network.name}.json`;
  const dir = resolve(__dirname, "../deployments");
  if (!existsSync(dir)) mkdirSync(dir);
  const file = resolve(dir, filename);

  const optimizerReceipt = await optimizerTx?.wait();
  const matchboxReceipt = await matchboxTx?.wait();
  const gaugeReceipt = await gaugeControllerTx?.wait();

  const json = {
    chainId: chainIdRaw,
    network: network.name,
    rpcUrl: (network.config as { url?: string }).url,
    explorer:
      network.name === "mezoTestnet" ? "https://explorer.test.mezo.org" : undefined,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MezoYieldOptimizer: {
        address: optimizerAddress,
        txHash: optimizerTx?.hash,
        blockNumber: optimizerReceipt?.blockNumber,
      },
      MockGaugeController: {
        address: gaugeControllerAddress,
        txHash: gaugeControllerTx?.hash,
        blockNumber: gaugeReceipt?.blockNumber,
      },
      MockMatchbox: {
        address: matchboxAddress,
        txHash: matchboxTx?.hash,
        blockNumber: matchboxReceipt?.blockNumber,
      },
    },
    notes:
      "MockGaugeController and MockMatchbox are testnet stand-ins because Mezo's real gauge/matchbox addresses aren't published yet (CONTEXT.md OQ #6). The real Mezo gauge system is mezo-org/tigris's Voter.sol (Solidly-style); STORY-005+ will introduce an adapter once subgraph data is wired. See TESTNET_ADDRESSES.md (STORY-010) for the full disclosure.",
  };

  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`Wrote ${file}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
