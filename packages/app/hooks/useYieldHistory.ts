"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import {
  OPTIMIZER_ADDRESS,
  OPTIMIZER_DEPLOYMENT_BLOCK,
} from "@/lib/contracts";
import { optimizerAbi } from "@/lib/abi";
import type { Address } from "@/lib/types";

/**
 * One bucket = one Unix-aligned 7-day epoch in which the user claimed
 * at least 1 wei of MUSD. `epoch` is `floor(blockTimestamp / 604_800)`,
 * so the value is monotonic and can be diffed for relative labels
 * ("Epoch -3" = 3 buckets behind the most recent). `musdWei` is the
 * sum of all `RewardsClaimed` events that fell into that bucket.
 *
 * §14: derived purely from on-chain logs. Empty history returns `[]`,
 * never invented bars.
 */
export type YieldBucket = {
  epoch: number;
  musdWei: bigint;
};

export type UseYieldHistoryResult = {
  epochs: YieldBucket[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

const SECONDS_PER_EPOCH = 604_800n;
const MAX_BUCKETS = 8;

const REWARDS_CLAIMED_EVENT = optimizerAbi.find(
  (item) => item.type === "event" && item.name === "RewardsClaimed",
);

/**
 * Codex P1 on PR #27: trimming to the last 8 *non-empty* claim buckets
 * misrepresents the X-axis as a calendar. A user who claimed in weeks 1
 * and 8 would otherwise see two bars sitting next to each other labeled
 * "Epoch -1, 0" — the chart would lie about the time-spacing between
 * claims and hide six zero-claim weeks. Absent epochs must appear as
 * zero-height bars so the gaps are visible.
 *
 * Pure helper — pad-to-MAX_BUCKETS-contiguous-epochs ending at
 * `anchorEpoch`, filling missing slots with `musdWei = 0n`. Empty input
 * → empty output (the empty-state UI in the chart handles that case).
 */
export function padContiguousEpochs(
  buckets: Map<number, bigint>,
  anchorEpoch: number,
): YieldBucket[] {
  if (buckets.size === 0) return [];
  const out: YieldBucket[] = [];
  for (let i = MAX_BUCKETS - 1; i >= 0; i--) {
    const epoch = anchorEpoch - i;
    out.push({ epoch, musdWei: buckets.get(epoch) ?? 0n });
  }
  return out;
}

/** Current Unix-aligned epoch index (seconds-since-epoch / 604_800). */
function nowEpoch(): number {
  return Math.floor(Date.now() / 1000 / 604_800);
}

/**
 * Fetch the user's last `MAX_BUCKETS` epochs of MUSD claims, grouped
 * by Unix-aligned epoch, by reading `RewardsClaimed(user)` event logs
 * from the optimizer.
 *
 * Why event logs (not the subgraph): Mezo doesn't ship a canonical
 * Goldsky subgraph for our optimizer's view (CONTEXT.md OQ #6 — same
 * gap STORY-005 papered over). Until one exists, getLogs is the source
 * of truth. STORY-009 spec explicitly allows this fallback.
 *
 * Why bound by `OPTIMIZER_DEPLOYMENT_BLOCK`: most public RPCs reject
 * `fromBlock: "earliest"` for being too broad. Bounding to the deploy
 * block keeps the request feasible and matches the only window in
 * which RewardsClaimed events for this address could exist.
 *
 * Per-block timestamp resolution requires a `getBlock` call per unique
 * block. Sequential awaits would be slow when claims span many blocks;
 * we batch via `Promise.all` over the unique block-number set.
 */
export function useYieldHistory(): UseYieldHistoryResult {
  const { address } = useAccount();
  const client = usePublicClient();

  const query = useQuery({
    queryKey: ["yield-history", address],
    enabled: !!address && !!client && !!REWARDS_CLAIMED_EVENT,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!address || !client || !REWARDS_CLAIMED_EVENT) return [];
      const logs = await client.getLogs({
        address: OPTIMIZER_ADDRESS,
        event: REWARDS_CLAIMED_EVENT,
        args: { user: address as Address },
        fromBlock: OPTIMIZER_DEPLOYMENT_BLOCK,
        toBlock: "latest",
      });
      if (logs.length === 0) return [];

      // Resolve each unique block's timestamp once.
      const uniqueBlocks = Array.from(
        new Set(logs.map((l) => l.blockNumber).filter((n): n is bigint => n != null)),
      );
      const blocks = await Promise.all(
        uniqueBlocks.map((blockNumber) => client.getBlock({ blockNumber })),
      );
      const tsByBlock = new Map<bigint, bigint>(
        blocks.map((b) => [b.number as bigint, b.timestamp]),
      );

      // Bucket by epoch.
      const buckets = new Map<number, bigint>();
      for (const log of logs) {
        const ts = log.blockNumber != null ? tsByBlock.get(log.blockNumber) : undefined;
        if (ts == null) continue;
        const epoch = Number(ts / SECONDS_PER_EPOCH);
        const amount = (log.args as { amount?: bigint })?.amount ?? 0n;
        buckets.set(epoch, (buckets.get(epoch) ?? 0n) + amount);
      }

      // Anchor the X-axis. The first instinct is "anchor=now so Epoch 0
      // is always right-now" — but Codex P1 round 2 on PR #27 caught the
      // edge case: when latestClaim < now-7, anchor=now puts the user's
      // claim OUTSIDE the trailing 8-epoch window and the chart shows 8
      // zeros, hiding their actual history.
      //
      // Correct rule: if the latest claim falls inside the trailing
      // 8-epoch window from now, anchor on now (current-relative labels,
      // user sees recent activity vs zero-weeks). Otherwise the user is
      // dormant — anchor on their latest claim instead so 8 weeks of
      // historical activity are at least visible.
      const claimEpochs = [...buckets.keys()];
      const latestClaim =
        claimEpochs.length > 0 ? Math.max(...claimEpochs) : -Infinity;
      const nowEp = nowEpoch();
      const anchor =
        latestClaim >= nowEp - (MAX_BUCKETS - 1) ? nowEp : latestClaim;
      return padContiguousEpochs(buckets, anchor);
    },
  });

  return {
    epochs: query.data ?? [],
    isLoading: query.isLoading && !!address,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
