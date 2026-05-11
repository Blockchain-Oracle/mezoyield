"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  OPTIMIZER_ADDRESS,
  OPTIMIZER_DEPLOYMENT_BLOCK,
} from "@/lib/contracts";
import { optimizerAbi } from "@/lib/abi";
import { getLogsChunked } from "@/lib/getLogsChunked";
import {
  fetchProtocolYieldHistoryFromSubgraph,
  type ProtocolYieldSubgraphResponse,
} from "@/lib/subgraph";
import { padContiguousEpochs, type YieldBucket } from "@/hooks/useYieldHistory";
import type { Address } from "@/lib/types";

/**
 * Protocol-aggregate version of useYieldHistory.
 *
 * Differences from the per-user hook:
 *
 *   1. NO `useAccount()` dependency — the landing's
 *      <ProtocolEarningsChart /> is a pre-connect surface, so this hook
 *      runs whether or not a wallet is connected.
 *
 *   2. `RewardsClaimed` logs are pulled WITHOUT a `user` arg filter —
 *      we want every claim across every account on the optimizer.
 *
 *   3. The hook surfaces `uniqueClaimants` so the chart can render a
 *      "N claimants this window" footnote.
 *
 *   4. When `NEXT_PUBLIC_GOLDSKY_PROTOCOL_URL` is configured, the
 *      subgraph is the source of truth and getLogs is skipped. When
 *      it isn't (the default), we fall back to the chunked-getLogs
 *      reader.
 *
 * §14: derived purely from on-chain logs or the configured subgraph.
 * Empty history returns `[]`, never invented bars.
 */

const SECONDS_PER_EPOCH = 604_800n;
const MAX_BUCKETS = 8;

const REWARDS_CLAIMED_EVENT = optimizerAbi.find(
  (item) => item.type === "event" && item.name === "RewardsClaimed",
);

export type ProtocolYieldHistoryResult = {
  epochs: YieldBucket[];
  /** Cross-account unique claimants observed in the indexed window. */
  uniqueClaimants: number;
  /** Optional placeholder for forward compat — total veMEZO is computed
   * elsewhere via useProtocolStrategyMix. Kept zero here so the hook
   * shape mirrors the chart's needs. */
  totalVeMezoWei: bigint;
  /** Strategy distribution placeholder — populated by the sibling
   * useProtocolStrategyMix hook. Empty array here keeps the chart
   * agnostic to the strategy-mix source. */
  strategyMix: Array<{ strategyId: string; percent: number }>;
  source: "subgraph" | "rpc" | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

/** Unix-aligned current epoch (matches per-user hook's nowEpoch). */
function nowEpoch(): number {
  return Math.floor(Date.now() / 1000 / 604_800);
}

/**
 * Compose final buckets from a pre-aggregated `buckets` map. Shares the
 * same anchor rule as useYieldHistory:
 *   - If the latest claim is inside [now-7, now] → anchor on now so
 *     "Epoch 0" reads as right-now.
 *   - Otherwise → anchor on latestClaim so the window contains it.
 */
function composeBuckets(buckets: Map<number, bigint>): YieldBucket[] {
  if (buckets.size === 0) return [];
  const claimEpochs = [...buckets.keys()];
  const latestClaim = Math.max(...claimEpochs);
  const nowEp = nowEpoch();
  const inNowWindow =
    latestClaim >= nowEp - (MAX_BUCKETS - 1) && latestClaim <= nowEp;
  const anchor = inNowWindow ? nowEp : latestClaim;
  return padContiguousEpochs(buckets, anchor);
}

export function useProtocolYieldHistory(): ProtocolYieldHistoryResult {
  const client = usePublicClient();

  // -- Path A: subgraph --
  const subgraphQuery = useQuery<ProtocolYieldSubgraphResponse | null>({
    queryKey: ["protocol-yield-history", "subgraph"],
    queryFn: fetchProtocolYieldHistoryFromSubgraph,
    retry: false,
    staleTime: 60_000,
  });

  const subgraphHasData = subgraphQuery.data != null;
  // Engage RPC fallback only when the subgraph has resolved with no data
  // (null = unconfigured, or after a transient error). Avoids two cold
  // requests on mount.
  const rpcEnabled = !subgraphHasData && !subgraphQuery.isLoading;

  // -- Path B: chunked getLogs (RPC fallback) --
  const rpcQuery = useQuery({
    queryKey: ["protocol-yield-history", "rpc"],
    enabled: !!client && !!REWARDS_CLAIMED_EVENT && rpcEnabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !REWARDS_CLAIMED_EVENT) {
        return { buckets: new Map<number, bigint>(), uniqueClaimants: 0 };
      }
      type RewardsClaimedLog = {
        blockNumber: bigint | null;
        args: { user?: Address; amount?: bigint };
      };
      // Note the absence of an `args: { user }` filter — we want EVERY
      // RewardsClaimed event across the optimizer.
      const logs = await getLogsChunked<RewardsClaimedLog>(
        client,
        {
          address: OPTIMIZER_ADDRESS,
          event: REWARDS_CLAIMED_EVENT,
        },
        OPTIMIZER_DEPLOYMENT_BLOCK,
        "latest",
      );
      if (logs.length === 0) {
        return { buckets: new Map<number, bigint>(), uniqueClaimants: 0 };
      }

      // Resolve each unique block's timestamp once.
      const uniqueBlocks = Array.from(
        new Set(
          logs.map((l) => l.blockNumber).filter((n): n is bigint => n != null),
        ),
      );
      const blocks = await Promise.all(
        uniqueBlocks.map((blockNumber) => client.getBlock({ blockNumber })),
      );
      const tsByBlock = new Map<bigint, bigint>(
        blocks.map((b) => [b.number as bigint, b.timestamp]),
      );

      const buckets = new Map<number, bigint>();
      const claimants = new Set<string>();
      for (const log of logs) {
        const ts =
          log.blockNumber != null ? tsByBlock.get(log.blockNumber) : undefined;
        if (ts == null) continue;
        const epoch = Number(ts / SECONDS_PER_EPOCH);
        const amount = (log.args as { amount?: bigint })?.amount ?? 0n;
        buckets.set(epoch, (buckets.get(epoch) ?? 0n) + amount);
        const u = (log.args as { user?: string })?.user;
        if (u) claimants.add(u.toLowerCase());
      }
      return { buckets, uniqueClaimants: claimants.size };
    },
  });

  // -- Compose --

  if (subgraphHasData && subgraphQuery.data) {
    const data = subgraphQuery.data;
    const buckets = new Map<number, bigint>(
      data.epochs.map((row) => [row.epoch, row.musdWei]),
    );
    return {
      epochs: composeBuckets(buckets),
      uniqueClaimants: data.uniqueClaimants,
      totalVeMezoWei: 0n,
      strategyMix: [],
      source: "subgraph",
      isLoading: false,
      isError: false,
      error: null,
    };
  }

  if (rpcEnabled && rpcQuery.data && !rpcQuery.error) {
    return {
      epochs: composeBuckets(rpcQuery.data.buckets),
      uniqueClaimants: rpcQuery.data.uniqueClaimants,
      totalVeMezoWei: 0n,
      strategyMix: [],
      source: "rpc",
      isLoading: false,
      isError: false,
      error: null,
    };
  }

  // Surface the active path's error explicitly — never swallow.
  const rpcError = (rpcQuery.error as Error | null) ?? null;
  if (rpcEnabled && rpcError) {
    return {
      epochs: [],
      uniqueClaimants: 0,
      totalVeMezoWei: 0n,
      strategyMix: [],
      source: null,
      isLoading: false,
      isError: true,
      error: rpcError,
    };
  }
  if (!rpcEnabled && (subgraphQuery.error as Error | null)) {
    return {
      epochs: [],
      uniqueClaimants: 0,
      totalVeMezoWei: 0n,
      strategyMix: [],
      source: null,
      isLoading: false,
      isError: true,
      error: subgraphQuery.error as Error,
    };
  }

  // Otherwise still loading.
  const isLoading = subgraphQuery.isLoading || rpcQuery.isLoading;
  return {
    epochs: [],
    uniqueClaimants: 0,
    totalVeMezoWei: 0n,
    strategyMix: [],
    source: null,
    isLoading,
    isError: false,
    error: null,
  };
}
