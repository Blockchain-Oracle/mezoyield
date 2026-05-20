import "dotenv/config";
import { defineChain } from "viem";
import testnetManifest from "@mezoyield/contracts/deployments/mezo-testnet.json" with { type: "json" };
import mainnetManifest from "@mezoyield/contracts/deployments/mezo-mainnet.json" with { type: "json" };

/**
 * Server-side mirror of `packages/app/lib/contracts.ts` — picks the
 * active deployment manifest from the `MEZO_NETWORK` env var (defaults
 * to `"testnet"`).
 *
 * Why two separate keeper services in Coolify rather than one
 * runtime-switching keeper: each network has its own EOA, its own gas
 * budget, its own epoch schedule, and its own failure mode. A runtime
 * switch would mean a bug in mainnet code paths could grief the testnet
 * keeper too. Domain-per-network keeps blast radius small — same
 * argument as the dual-domain app deploy.
 */

type DeployedContract = {
  address: string | null;
  txHash: string | null;
  blockNumber: number | null;
};

type DeploymentManifest = {
  chainId: number;
  network: string;
  rpcUrl: string;
  explorer?: string;
  deployer: string;
  contracts: {
    MezoYieldOptimizer: DeployedContract;
    MockGaugeController: DeployedContract;
    MockMatchbox: DeployedContract;
    MockVeMezo: DeployedContract;
  };
};

// Strict validation — Codex P2 (round 3) mirror: see app's contracts.ts
// for rationale. A typo in MEZO_NETWORK that silently picks testnet
// would point the mainnet keeper at testnet manifest = wrong RPC + wrong
// Optimizer = grief without any obvious signal.
const rawNetwork = process.env.MEZO_NETWORK;
let NETWORK: "testnet" | "mainnet";
if (rawNetwork === undefined || rawNetwork === "" || rawNetwork === "testnet") {
  NETWORK = "testnet";
} else if (rawNetwork === "mainnet") {
  NETWORK = "mainnet";
} else {
  throw new Error(
    `Invalid MEZO_NETWORK="${rawNetwork}". ` +
      `Expected "testnet", "mainnet", or unset (= "testnet"). ` +
      `Common cause: typo in the Coolify env var.`,
  );
}

const manifest = (
  NETWORK === "mainnet" ? mainnetManifest : testnetManifest
) as unknown as DeploymentManifest;

const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY ?? "";
const KEEPER_RPC_URL = process.env.KEEPER_RPC_URL ?? manifest.rpcUrl;

if (!KEEPER_PRIVATE_KEY || !KEEPER_PRIVATE_KEY.startsWith("0x")) {
  throw new Error(
    "KEEPER_PRIVATE_KEY missing — set it in packages/keeper/.env (see .env.example)",
  );
}

const optimizerAddress = manifest.contracts.MezoYieldOptimizer.address;
if (!optimizerAddress) {
  // Mainnet manifest ships with a null Optimizer until the deploy
  // happens. Fail fast so the keeper never starts pointing at nothing.
  throw new Error(
    `MezoYieldOptimizer not yet deployed on Mezo ${NETWORK}. ` +
      `Run \`pnpm --filter @mezoyield/contracts run deploy:${NETWORK}\` ` +
      `and commit the updated mezo-${NETWORK}.json before starting the keeper.`,
  );
}

const gaugeControllerAddress = manifest.contracts.MockGaugeController.address;
if (!gaugeControllerAddress) {
  throw new Error(
    `MockGaugeController address missing from mezo-${NETWORK}.json — keeper cannot read gauge data.`,
  );
}

const matchboxAddress = manifest.contracts.MockMatchbox.address;
if (!matchboxAddress) {
  throw new Error(
    `MockMatchbox address missing from mezo-${NETWORK}.json — wiring required before keeper can start.`,
  );
}

const explorer = manifest.explorer ?? "";

/**
 * Mezo chain definition for viem. The chain ID + RPC come from whichever
 * manifest is active; the name string follows for symmetry.
 *
 * Native currency is `BTC` on mainnet and `tBTC` on testnet — both
 * 18-decimal precompiles. Gas is paid in whichever, per Mezo docs:
 * https://mezo.org/docs/users/getting-started/connect/
 */
export const mezoChain = defineChain({
  id: manifest.chainId,
  name: NETWORK === "mainnet" ? "Mezo Mainnet" : "Mezo Testnet",
  nativeCurrency: {
    name: NETWORK === "mainnet" ? "BTC" : "tBTC",
    symbol: NETWORK === "mainnet" ? "BTC" : "tBTC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [KEEPER_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: explorer },
  },
});

// Alias retained so STORY-004's keeper tests still import `mezoTestnet`.
export const mezoTestnet = mezoChain;

export const MEZO_NETWORK = NETWORK;
export const OPTIMIZER_ADDRESS = optimizerAddress as `0x${string}`;
export const GAUGE_CONTROLLER_ADDRESS = gaugeControllerAddress as `0x${string}`;
export const MATCHBOX_ADDRESS = matchboxAddress as `0x${string}`;

// Lower bound for backwards-walking eth_getLogs queries against the
// optimizer (see `lastVoteEpoch.ts`). Mainnet manifest carries the
// deploy block after Phase 5 lands; until then, fall back to 0 (the
// walk just becomes more expensive in the no-deploy state, which can't
// happen because we already throw above when the Optimizer address is
// null).
export const OPTIMIZER_DEPLOYMENT_BLOCK = BigInt(
  manifest.contracts.MezoYieldOptimizer.blockNumber ?? 0,
);

export const KEEPER_KEY = KEEPER_PRIVATE_KEY as `0x${string}`;
export const RPC_URL = KEEPER_RPC_URL;
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";
