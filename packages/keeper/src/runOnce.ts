import { createPublicClient, createWalletClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import pino from "pino";
import {
  KEEPER_KEY,
  OPTIMIZER_ADDRESS,
  OPTIMIZER_DEPLOYMENT_BLOCK,
  RPC_URL,
  mezoTestnet,
} from "./config.js";
import { computeOptimalAllocation, loadGauges } from "./computeOptimalAllocation.js";
import { getLastVote } from "./lastVoteEpoch.js";
import {
  runKeeperFlow,
  type RunOnceOptions,
  type RunOnceResult,
} from "./keeperFlow.js";
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

// Public re-exports — the flow types live in `./keeperFlow.js` so they
// can be imported by tests without dragging in `./config.js` (which
// throws at load when KEEPER_PRIVATE_KEY is absent — codex P1 round 4).
export type { RunOnceResult, RunOnceOptions } from "./keeperFlow.js";

/**
 * Single-shot keeper run. Builds the viem clients, signer, and dependency
 * adapters, then defers to `runKeeperFlow` for the actual flow logic
 * (which is unit-tested with stubbed deps). All side-effecting IO lives
 * in this shim; the decision logic lives in `runKeeperFlow` and the
 * pure helpers it composes.
 *
 * Used for the demo (manual `pnpm --filter @mezoyield/keeper run once`)
 * and as the inner loop body of `index.ts`'s cron loop.
 */
export async function runOnce(opts: RunOnceOptions = {}): Promise<RunOnceResult> {
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

  logger.info({ keeper: account.address }, "keeper run starting");

  return runKeeperFlow(
    {
      getHeadTimestamp: async () => {
        const head = await publicClient.getBlock({ blockTag: "latest" });
        return head.timestamp;
      },
      findLastVote: (earliestRelevantTimestamp) =>
        getLastVote(
          publicClient,
          {
            address: OPTIMIZER_ADDRESS,
            deploymentBlock: OPTIMIZER_DEPLOYMENT_BLOCK,
          },
          earliestRelevantTimestamp,
        ),
      loadGauges: () => loadGauges(publicClient),
      computeAllocation: (gauges) => {
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
        return allocation;
      },
      submitVote: async (allocation) => {
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
        return { txHash, blockNumber: receipt.blockNumber };
      },
      notify,
    },
    opts,
  );
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

// Direct invocation: `tsx src/runOnce.ts` (or `pnpm --filter
// @mezoyield/keeper once`). Defaults to `force: true` so the manual
// demo invocation always emits a fresh receipt — useful when judges
// want to see a live tx hash on the landing's ProofLedger even though
// the cron loop already voted earlier in the epoch. Override with
// `KEEPER_FORCE=0` to honor the epoch guard during manual runs (e.g.
// in CI checks).
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("runOnce.ts")
) {
  const force = process.env.KEEPER_FORCE !== "0";
  runOnce({ force })
    .then((result) => {
      if (result.status === "submitted") {
        logger.info({ txHash: result.txHash, epoch: result.epoch }, "done");
      } else {
        logger.info(
          { reason: result.reason, epoch: result.epoch },
          "no-op (already voted this epoch)",
        );
      }
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, "failed");
      process.exit(1);
    });
}
