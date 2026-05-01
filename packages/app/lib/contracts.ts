import deployments from "@mezoyield/contracts/deployments/mezo-testnet.json";

/**
 * Frontend handles for the contracts deployed in STORY-004 to Mezo Testnet
 * (chain 31611). Sourced from `packages/contracts/deployments/mezo-testnet.json`,
 * which is committed alongside the deploy. Keeps the on-chain handles in one
 * place so STORY-005+ wagmi hooks can import and reuse, and so a redeploy
 * (STORY-008 may rebuild the optimizer) only flips the JSON without touching
 * component code.
 *
 * MockGaugeController + MockMatchbox ride along because Mezo's real gauge /
 * matchbox addresses aren't published yet (CONTEXT.md OQ #6). The real Mezo
 * gauge system is mezo-org/tigris's Voter.sol (Solidly-style) — see
 * `context/refs/sponsor-repos.md` and the JSON's `notes` field for the
 * disclosure. STORY-005+ will swap to a Tigris adapter when subgraph data
 * lands.
 */

type DeployedContract = {
  address: `0x${string}`;
  txHash: `0x${string}`;
  blockNumber: number;
};

type DeploymentManifest = {
  chainId: number;
  network: string;
  rpcUrl: string;
  explorer?: string;
  deployer: `0x${string}`;
  deployedAt: string;
  contracts: {
    MezoYieldOptimizer: DeployedContract;
    MockGaugeController: DeployedContract;
    MockMatchbox: DeployedContract;
  };
  notes: string;
};

const manifest = deployments as unknown as DeploymentManifest;

if (manifest.chainId !== 31611) {
  throw new Error(
    `Expected Mezo testnet (31611) deployment manifest, got chainId ${manifest.chainId}.`,
  );
}

export const MEZO_TESTNET_CHAIN_ID = manifest.chainId;
export const MEZO_TESTNET_RPC_URL = manifest.rpcUrl;
export const MEZO_TESTNET_EXPLORER = manifest.explorer;

export const OPTIMIZER_ADDRESS = manifest.contracts.MezoYieldOptimizer.address;
export const GAUGE_CONTROLLER_ADDRESS =
  manifest.contracts.MockGaugeController.address;
export const MATCHBOX_ADDRESS = manifest.contracts.MockMatchbox.address;

export const DEPLOYMENT_MANIFEST = manifest;
