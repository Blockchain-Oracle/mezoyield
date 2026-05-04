import type {
  Allocation,
  GaugeInfo,
} from "./computeOptimalAllocation.js";
import type { LastVote } from "./lastVoteEpoch.js";
import { epochOf, shouldSubmitVote } from "./lastVoteEpoch.js";

/**
 * Pure flow logic for the keeper. Lives in its own module — distinct
 * from `runOnce.ts` — so it can be unit-tested without dragging in
 * `./config.js`, which throws at module-load when `KEEPER_PRIVATE_KEY`
 * is absent (codex P1 round 4 on PR #29).
 *
 * `runOnce.ts` is the side-effecting wiring shim that builds real viem
 * clients + signer + reads the deployment manifest. `runKeeperFlow`
 * here takes everything as injected functions, so tests can stub them
 * with `vi.fn()` and exercise every branch of the skip/submit/force
 * decision tree.
 *
 * Termination policy + epoch-bound math are documented on the helpers
 * this composes (`epochOf`, `shouldSubmitVote`, `findLatestVoteFromChunks`
 * via `getLastVote`).
 */

export type RunOnceResult =
  | { status: "submitted"; txHash: `0x${string}`; epoch: number }
  | { status: "skipped"; reason: "already-voted-this-epoch"; epoch: number };

export type RunOnceOptions = {
  /**
   * Bypass the per-epoch dedup check. Default `false`. The cron loop in
   * `index.ts` always uses `false`. The manual `pnpm run once` demo
   * sets `true` so the demo always emits a fresh receipt regardless of
   * whether the keeper already voted earlier in the epoch.
   *
   * Codex P1 on PR #29: without an epoch guard the daily cron + boot
   * run would emit ~7× the necessary VoteCast events per epoch,
   * spamming the landing's ProofLedger and burning keeper gas — the
   * MockGaugeController doesn't enforce one-vote-per-epoch on chain.
   */
  force?: boolean;
};

export type NotifyArgs = {
  txHash: `0x${string}`;
  blockNumber: string;
  allocation: { name: string; weightBps: number }[];
};

/**
 * Boundaries the flow needs:
 *   - `getHeadTimestamp`     → `publicClient.getBlock("latest").timestamp`
 *   - `findLastVote(bound)`  → backwards-walks VoteCast events via getLastVote
 *   - `loadGauges()`         → live gauge state from MockGaugeController + Matchbox
 *   - `computeAllocation`    → pure (autoAllocate); kept injected so the
 *                              test can verify the wiring + spy on it
 *   - `submitVote(alloc)`    → walletClient.writeContract + waitForTransactionReceipt
 *   - `notify(args)`         → optional Discord webhook
 */
export type KeeperFlowDeps = {
  getHeadTimestamp: () => Promise<bigint>;
  findLastVote: (
    earliestRelevantTimestamp: bigint,
  ) => Promise<LastVote | null>;
  loadGauges: () => Promise<GaugeInfo[]>;
  computeAllocation: (gauges: GaugeInfo[]) => Allocation;
  submitVote: (
    allocation: Allocation,
  ) => Promise<{ txHash: `0x${string}`; blockNumber: bigint }>;
  notify?: (args: NotifyArgs) => Promise<void>;
};

export async function runKeeperFlow(
  deps: KeeperFlowDeps,
  opts: RunOnceOptions = {},
): Promise<RunOnceResult> {
  const headTs = await deps.getHeadTimestamp();
  const currentEpoch = epochOf(headTs);
  // Pass the current epoch's start timestamp as the scan bound so the
  // backward walk always covers ≥ one epoch's worth of chain time
  // regardless of block speed (codex P1 round 3 on PR #29).
  const currentEpochStart = BigInt(currentEpoch) * 604_800n;

  const lastVote = opts.force ? null : await deps.findLastVote(currentEpochStart);
  const decision = shouldSubmitVote({
    currentEpoch,
    lastVote,
    force: !!opts.force,
  });

  if (!decision.submit) {
    return {
      status: "skipped",
      reason: decision.reason,
      epoch: currentEpoch,
    };
  }

  const gauges = await deps.loadGauges();
  if (gauges.length === 0) {
    throw new Error("no gauges registered on the controller");
  }
  const allocation = deps.computeAllocation(gauges);
  const { txHash, blockNumber } = await deps.submitVote(allocation);

  if (deps.notify) {
    await deps.notify({
      txHash,
      blockNumber: blockNumber.toString(),
      allocation: allocation.gauges.map((g, i) => {
        const meta = gauges.find((x) => x.address === g);
        return {
          name: meta?.name ?? g,
          weightBps: Number(allocation.weights[i]),
        };
      }),
    });
  }

  return { status: "submitted", txHash, epoch: currentEpoch };
}
