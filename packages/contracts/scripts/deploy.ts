import { ethers, network } from "hardhat";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

/**
 * Deploys MockGaugeController, MockMatchbox, MezoYieldOptimizer to the
 * configured network and writes a canonical deployments JSON
 * (`deployments/mezo-testnet.json` for chainId 31611, `mezo-mainnet.json`
 * for 31612). The app side imports the right manifest via
 * `packages/app/lib/contracts.ts`.
 *
 * Mocks ride along because Mezo hasn't published canonical gauge/matchbox
 * addresses yet (CONTEXT.md OQ #6); see the JSON's `notes` and
 * `TESTNET_ADDRESSES.md` for the disclosure. STORY-005+ will introduce a
 * Tigris adapter (`mezo-org/tigris`'s Voter.sol) when subgraph data lands.
 *
 * Slug map (Hardhat network name → file slug) matches story-004 spec:
 * kebab-case mezo-testnet.json regardless of the camelCase Hardhat name.
 *
 * STORY-005 addition: after deploying, the script seeds the gauge
 * registry on MockGaugeController and the bribe pools on MockMatchbox
 * with three realistic-feeling gauges (Stability Pool, MUSD Savings,
 * BTC-MUSD LP). The seeded gauges + bribes are echoed into the manifest
 * under `seededGauges` so the frontend test fixtures and TESTNET_ADDRESSES
 * stay in sync.
 */
const NETWORK_FILENAMES: Record<string, string> = {
  mezoTestnet: "mezo-testnet.json",
  mezoMainnet: "mezo-mainnet.json",
};

type SeedGauge = {
  name: string;
  totalVeMezo: bigint;
  bribeMUSD: bigint;
};

const SEED_GAUGES: SeedGauge[] = [
  {
    name: "Stability Pool",
    totalVeMezo: ethers.parseUnits("12500000", 18),
    bribeMUSD: ethers.parseUnits("8400", 18),
  },
  {
    name: "MUSD Savings Rate",
    totalVeMezo: ethers.parseUnits("9200000", 18),
    bribeMUSD: ethers.parseUnits("4500", 18),
  },
  {
    name: "BTC-MUSD LP",
    totalVeMezo: ethers.parseUnits("6700000", 18),
    bribeMUSD: ethers.parseUnits("5200", 18),
  },
];

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

  // -------- Deploy --------

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

  const VeMezoFactory = await ethers.getContractFactory("MockVeMezo");
  const veMezo = await VeMezoFactory.deploy();
  const veMezoTx = veMezo.deploymentTransaction();
  await veMezo.waitForDeployment();
  const veMezoAddress = await veMezo.getAddress();
  console.log(`MockVeMezo: ${veMezoAddress}`);

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

  // -------- Seed (STORY-005) --------

  console.log("Seeding gauge registry + bribes...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gc: any = gaugeController;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mb: any = matchbox;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ve: any = veMezo;
  const seedReceipts: { name: string; gauge: string }[] = [];
  for (const g of SEED_GAUGES) {
    const tx = await gc.addGauge(g.name, g.totalVeMezo);
    await tx.wait();
    const gaugeAddress: string = await gc.gaugeAddressFor(g.name);
    const bribeTx = await mb.setBribe(gaugeAddress, g.bribeMUSD);
    await bribeTx.wait();
    seedReceipts.push({ name: g.name, gauge: gaugeAddress });
    console.log(`  ${g.name} → ${gaugeAddress}`);
  }

  // Seed the deployer with a sample veMEZO balance so the dashboard's
  // PositionCard renders a non-empty position out of the box. Any other
  // address can call `faucet()` themselves to top up.
  const SEED_DEPLOYER_BALANCE = ethers.parseUnits("1500", 18);
  console.log(`Minting ${SEED_DEPLOYER_BALANCE.toString()} wei veMEZO to deployer...`);
  const mintTx = await ve.mint(deployer.address, SEED_DEPLOYER_BALANCE);
  await mintTx.wait();

  if (network.name === "hardhat") {
    console.log("(hardhat-network: ephemeral; skipping JSON emit)");
    return;
  }

  // -------- Write manifest --------

  const filename = NETWORK_FILENAMES[network.name] ?? `${network.name}.json`;
  const dir = resolve(__dirname, "../deployments");
  if (!existsSync(dir)) mkdirSync(dir);
  const file = resolve(dir, filename);

  const optimizerReceipt = await optimizerTx?.wait();
  const matchboxReceipt = await matchboxTx?.wait();
  const gaugeReceipt = await gaugeControllerTx?.wait();
  const veMezoReceipt = await veMezoTx?.wait();

  const json = {
    chainId: chainIdRaw,
    network: network.name,
    rpcUrl: (network.config as { url?: string }).url,
    explorer:
      network.name === "mezoTestnet"
        ? "https://explorer.test.mezo.org"
        : network.name === "mezoMainnet"
          ? "https://explorer.mezo.org"
          : undefined,
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
      MockVeMezo: {
        address: veMezoAddress,
        txHash: veMezoTx?.hash,
        blockNumber: veMezoReceipt?.blockNumber,
      },
    },
    seedDeployerVeMezoWei: SEED_DEPLOYER_BALANCE.toString(),
    seededGauges: SEED_GAUGES.map((g, i) => ({
      name: g.name,
      address: seedReceipts[i].gauge,
      totalVeMezoWei: g.totalVeMezo.toString(),
      bribeMUSDWei: g.bribeMUSD.toString(),
    })),
    notes:
      "MockGaugeController and MockMatchbox are testnet stand-ins because Mezo's real gauge/matchbox addresses aren't published yet (CONTEXT.md OQ #6). The real Mezo gauge system is mezo-org/tigris's Voter.sol (Solidly-style); STORY-005+ will introduce an adapter once subgraph data is wired. Seeded gauges are deterministic addresses (keccak(name) truncated to 160 bits) — see TESTNET_ADDRESSES.md (STORY-010) for the full disclosure.",
  };

  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`Wrote ${file}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
