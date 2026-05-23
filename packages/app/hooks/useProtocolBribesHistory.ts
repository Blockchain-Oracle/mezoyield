"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  MATCHBOX_ADDRESS,
  MATCHBOX_DEPLOYMENT_BLOCK,
  MEZO_NETWORK,
} from "@/lib/contracts";
import { getLogsChunked } from "@/lib/getLogsChunked";
import { padContiguousEpochs, type YieldBucket } from "@/hooks/useYieldHistory";
import type { Address } from "@/lib/types";

/**
 * Protocol-aggregate MUSD bribed into the gauges, bucketed by weekly
 * epoch. Powers the landing-page <ProtocolEarningsChart /> in place of
 * the original `useProtocolYieldHistory`.
 *
 * Why we swapped off `RewardsClaimed`: that event fires at the END of
 * the lifecycle (user calls `claim()` after an epoch settles). The
 * keeper has been voting and sponsors have been posting bribes for days
 * on both networks, but no user has yet pulled their MUSD — so the
 * old chart correctly read 0/0/0. Bribes are the *upstream* signal:
 * the MUSD that will eventually become a claim. Charting them shows
 * the protocol is alive even pre-first-claim.
 *
 * Cross-network gotcha — the matchbox slot in the manifest holds
 * DIFFERENT contracts on each chain, with DIFFERENT event names:
 *   - testnet: `MockMatchbox` emits `BribeSet(address,uint256)`
 *   - mainnet: `MatchboxAdapter` emits `BribeUpdated(address,uint256)`
 * Same semantics (gauge + MUSD amount), different topic hashes. We
 * branch on `MEZO_NETWORK` rather than querying both, so a future
 * MatchboxAdapter testnet deploy (which would emit BribeUpdated) still
 * works without code changes if we update the network flag.
 *
 * §14: derived purely from on-chain logs; empty history returns `[]`.
 */

const SECONDS_PER_EPOCH = 604_800n;
const MAX_BUCKETS = 8;

// Event ABI fragments — viem accepts these for `event` in getLogs and
// recovers typed args at decode time.
const BRIBE_UPDATED_EVENT = {
  type: "event",
  name: "BribeUpdated",
  inputs: [
    { name: "gauge", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
  ],
} as const;

const BRIBE_SET_EVENT = {
  type: "event",
  name: "BribeSet",
  inputs: [
    { name: "gauge", type: "address", indexed: true },
    { name: "musdAmount", type: "uint256", indexed: false },
  ],
} as const;

export type ProtocolBribesHistoryResult = {
  epochs: YieldBucket[];
  /** Per-gauge latest bribe — primary view for the landing chart.
   * Sorted descending by amount so the largest-bribed gauge renders
   * first. Each entry is the LATEST `BribeUpdated`/`BribeSet` value
   * for that gauge (these events SET, not increment). */
  byGauge: Array<{ gauge: Address; amountWei: bigint }>;
  /** Unique gauges that received a bribe in the indexed window. Slots
   * into the chart footnote where claimants used to live. */
  uniqueGauges: number;
  source: "rpc" | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000 / 604_800);
}

function composeBuckets(buckets: Map<number, bigint>): YieldBucket[] {
  if (buckets.size === 0) return [];
  const claimEpochs = [...buckets.keys()];
  const latest = Math.max(...claimEpochs);
  const nowEp = nowEpoch();
  const inNowWindow =
    latest >= nowEp - (MAX_BUCKETS - 1) && latest <= nowEp;
  const anchor = inNowWindow ? nowEp : latest;
  return padContiguousEpochs(buckets, anchor);
}

export function useProtocolBribesHistory(): ProtocolBribesHistoryResult {
  const client = usePublicClient();
  const event = MEZO_NETWORK === "mainnet" ? BRIBE_UPDATED_EVENT : BRIBE_SET_EVENT;
  // Each call to `BribeUpdated`/`BribeSet` REPLACES the gauge's bribe
  // (it's an absolute set, not an increment). So per-epoch "MUSD
  // flowing in" is the SUM of latest values per gauge that landed in
  // that epoch — not the sum of every log amount. We still bucket the
  // raw events by epoch; the latest log per gauge within an epoch wins.

  const query = useQuery({
    queryKey: ["protocol-bribes-history", MEZO_NETWORK, MATCHBOX_ADDRESS],
    enabled: !!client && !!MATCHBOX_ADDRESS,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      if (!client) {
        return {
          buckets: new Map<number, bigint>(),
          uniqueGauges: 0,
          byGauge: [] as Array<{ gauge: Address; amountWei: bigint }>,
        };
      }
      type BribeLog = {
        blockNumber: bigint | null;
        args: {
          gauge?: Address;
          amount?: bigint;
          musdAmount?: bigint;
        };
      };
      const logs = await getLogsChunked<BribeLog>(
        client,
        {
          address: MATCHBOX_ADDRESS,
          event,
        },
        MATCHBOX_DEPLOYMENT_BLOCK,
        "latest",
      );
      if (logs.length === 0) {
        return {
          buckets: new Map<number, bigint>(),
          uniqueGauges: 0,
          byGauge: [] as Array<{ gauge: Address; amountWei: bigint }>,
        };
      }

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

      // Per-epoch latest value per gauge — keeps the per-week buckets
      // honest when a gauge's bribe is updated twice in the same
      // epoch. Also maintain a cross-epoch latest-per-gauge map so
      // we can expose the current bribe distribution per gauge (the
      // chart's primary view).
      const perEpoch = new Map<number, Map<string, bigint>>();
      const latestPerGauge = new Map<string, { amount: bigint; block: bigint }>();
      for (const log of logs) {
        const ts =
          log.blockNumber != null ? tsByBlock.get(log.blockNumber) : undefined;
        if (ts == null || log.blockNumber == null) continue;
        const epoch = Number(ts / SECONDS_PER_EPOCH);
        const gauge = log.args.gauge?.toLowerCase();
        const amount = log.args.amount ?? log.args.musdAmount ?? 0n;
        if (!gauge) continue;
        const inner = perEpoch.get(epoch) ?? new Map<string, bigint>();
        inner.set(gauge, amount);
        perEpoch.set(epoch, inner);
        const prev = latestPerGauge.get(gauge);
        if (!prev || log.blockNumber > prev.block) {
          latestPerGauge.set(gauge, { amount, block: log.blockNumber });
        }
      }

      const buckets = new Map<number, bigint>();
      for (const [epoch, perGauge] of perEpoch.entries()) {
        let sum = 0n;
        for (const v of perGauge.values()) sum += v;
        buckets.set(epoch, sum);
      }

      const byGauge = Array.from(latestPerGauge.entries())
        .map(([gauge, { amount }]) => ({
          gauge: gauge as Address,
          amountWei: amount,
        }))
        .sort((a, b) => (a.amountWei > b.amountWei ? -1 : a.amountWei < b.amountWei ? 1 : 0));

      return { buckets, uniqueGauges: latestPerGauge.size, byGauge };
    },
  });

  if (query.data && !query.error) {
    return {
      epochs: composeBuckets(query.data.buckets),
      byGauge: query.data.byGauge,
      uniqueGauges: query.data.uniqueGauges,
      source: "rpc",
      isLoading: false,
      isError: false,
      error: null,
    };
  }

  if (query.error) {
    return {
      epochs: [],
      byGauge: [],
      uniqueGauges: 0,
      source: null,
      isLoading: false,
      isError: true,
      error: query.error as Error,
    };
  }

  return {
    epochs: [],
    byGauge: [],
    uniqueGauges: 0,
    source: null,
    isLoading: query.isLoading,
    isError: false,
    error: null,
  };
}
