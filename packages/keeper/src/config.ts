import "dotenv/config";
import { defineChain } from "viem";
import deployments from "@mezoyield/contracts/deployments/mezo-testnet.json" with { type: "json" };

const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY ?? "";
const KEEPER_RPC_URL = process.env.KEEPER_RPC_URL ?? deployments.rpcUrl;

if (!KEEPER_PRIVATE_KEY || !KEEPER_PRIVATE_KEY.startsWith("0x")) {
  throw new Error(
    "KEEPER_PRIVATE_KEY missing — set it in packages/keeper/.env (see .env.example)",
  );
}

/**
 * Mezo Testnet chain definition for viem. Chain ID matches what the
 * frontend uses (`packages/app/lib/contracts.ts`); deployment manifest
 * is the source of truth for RPC + explorer URLs.
 */
export const mezoTestnet = defineChain({
  id: deployments.chainId,
  name: "Mezo Testnet",
  nativeCurrency: { name: "tBTC", symbol: "tBTC", decimals: 18 },
  rpcUrls: {
    default: { http: [KEEPER_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: deployments.explorer ?? "" },
  },
});

export const OPTIMIZER_ADDRESS = deployments.contracts.MezoYieldOptimizer
  .address as `0x${string}`;
export const GAUGE_CONTROLLER_ADDRESS = deployments.contracts
  .MockGaugeController.address as `0x${string}`;
export const MATCHBOX_ADDRESS = deployments.contracts.MockMatchbox
  .address as `0x${string}`;

// Lower bound for backwards-walking eth_getLogs queries against the
// optimizer (see `lastVoteEpoch.ts`). Mezo testnet RPC caps getLogs at
// 10_000 blocks per call; bounding to the deploy block keeps the walk
// finite and matches the only window in which VoteCast events for this
// address could exist.
export const OPTIMIZER_DEPLOYMENT_BLOCK = BigInt(
  deployments.contracts.MezoYieldOptimizer.blockNumber,
);

export const KEEPER_KEY = KEEPER_PRIVATE_KEY as `0x${string}`;
export const RPC_URL = KEEPER_RPC_URL;
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";
