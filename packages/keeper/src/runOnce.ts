import { createPublicClient, createWalletClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import pino from "pino";
import {
  KEEPER_KEY,
  OPTIMIZER_ADDRESS,
  RPC_URL,
  mezoTestnet,
} from "./config.js";
import { computeOptimalAllocation, loadGauges } from "./computeOptimalAllocation.js";
import { notify } from "./notifier.js";

const logger = pino({
  transport: { target: "pino-pretty", options: { colorize: true } },
});

const optimizerAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "castOptimalVote",
    inputs: [
      { name: "gauges", type: "address[]" },
      { name: "weights", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

/**
 * Single-shot keeper run. Loads live gauge state, computes the optimal
 * allocation, signs and submits `castOptimalVote(gauges, weights)`,
 * waits for receipt, fires the notifier.
 *
 * Used for the demo (manual `pnpm --filter @mezoyield/keeper run once`)
 * and as the inner loop body of `index.ts`'s cron loop.
 */
export async function runOnce(): Promise<{ txHash: string }> {
  const account = privateKeyToAccount(KEEPER_KEY);
  const publicClient = createPublicClient({
    chain: mezoTestnet,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: mezoTestnet,
    transport: http(RPC_URL),
  });

  logger.info({ keeper: account.address }, "loading live gauge state");
  const gauges = await loadGauges(publicClient);
  if (gauges.length === 0) {
    logger.warn("no gauges registered — nothing to vote on");
    throw new Error("no gauges registered on the controller");
  }

  const allocation = computeOptimalAllocation(gauges);
  logger.info(
    {
      gauges: allocation.gauges.length,
      breakdown: allocation.gauges.map((g, i) => {
        const meta = gauges.find((x) => x.address === g);
        return {
          name: meta?.name ?? g,
          weightBps: Number(allocation.weights[i]),
          apy: meta
            ? estimateApyPercent(meta.bribeMUSDWei, meta.totalVeMezoWei)
            : null,
        };
      }),
    },
    "computed optimal allocation",
  );

  logger.info("submitting castOptimalVote…");
  const txHash = await walletClient.writeContract({
    address: OPTIMIZER_ADDRESS,
    abi: optimizerAbi,
    functionName: "castOptimalVote",
    args: [allocation.gauges, allocation.weights],
  });
  logger.info({ txHash }, "submitted; waiting for receipt");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  logger.info(
    { txHash, blockNumber: receipt.blockNumber, status: receipt.status },
    "confirmed",
  );

  await notify({
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    allocation: allocation.gauges.map((g, i) => {
      const meta = gauges.find((x) => x.address === g);
      return {
        name: meta?.name ?? g,
        weightBps: Number(allocation.weights[i]),
      };
    }),
  });

  return { txHash };
}

function estimateApyPercent(
  bribeWei: bigint,
  totalVeMezoWei: bigint,
): number | null {
  if (totalVeMezoWei === 0n) return null;
  const SCALE = 10n ** 18n;
  const ratio = (bribeWei * SCALE) / totalVeMezoWei;
  return Number(formatUnits(ratio, 18)) * 52 * 100;
}

// Direct invocation: `tsx src/runOnce.ts`
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("runOnce.ts")
) {
  runOnce()
    .then(({ txHash }) => {
      logger.info({ txHash }, "done");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, "failed");
      process.exit(1);
    });
}
