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
    MockVeMezo: DeployedContract;
  };
  notes: string;
};

const manifest = deployments as unknown as DeploymentManifest;

// Accept both Mezo testnet (31611) and mainnet (31612) so the same lib
// works against either deployment manifest. CLAUDE.md commits to a
// future mainnet deploy; readers of this file should not need to edit
// the assertion when that lands. Other chains are rejected fast so a
// stray manifest doesn't silently mis-wire the app.
const ACCEPTED_CHAIN_IDS = new Set<number>([31611, 31612]);
if (!ACCEPTED_CHAIN_IDS.has(manifest.chainId)) {
  throw new Error(
    `Expected Mezo testnet (31611) or mainnet (31612) deployment, got chainId ${manifest.chainId}.`,
  );
}

export const MEZO_CHAIN_ID = manifest.chainId;
export const MEZO_RPC_URL = manifest.rpcUrl;
export const MEZO_EXPLORER = manifest.explorer;

// Deprecated aliases retained so STORY-004's tests don't break.
export const MEZO_TESTNET_CHAIN_ID = manifest.chainId;
export const MEZO_TESTNET_RPC_URL = manifest.rpcUrl;
export const MEZO_TESTNET_EXPLORER = manifest.explorer;

export const OPTIMIZER_ADDRESS = manifest.contracts.MezoYieldOptimizer.address;
export const GAUGE_CONTROLLER_ADDRESS =
  manifest.contracts.MockGaugeController.address;
export const MATCHBOX_ADDRESS = manifest.contracts.MockMatchbox.address;
export const VE_MEZO_ADDRESS = manifest.contracts.MockVeMezo.address;

export const DEPLOYMENT_MANIFEST = manifest;
