"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { GAUGE_CONTROLLER_ADDRESS } from "@/lib/contracts";
import { gaugeControllerAbi } from "@/lib/abi";
import type { Address } from "@/lib/types";
import { STRATEGY_PRESETS } from "@/features/strategies/presets";

/**
 * Protocol-aggregate share of veMEZO routed through each single-gauge
 * strategy's target gauge. Feeds the "47% of protocol veMEZO routes
 * to {gauge}" line and the "most used" badge on /app/strategies.
 *
 * Honest scope (Codex review, PR #v2-redesign):
 * `gaugeMeta(gauge).totalVeMezo` returns the gauge-level aggregate
 * vote weight, NOT the strategy-level usage. We CAN truthfully
 * attribute it to the three single-gauge presets (Stability Max /
 * MUSD Saver / BTC-LP Farmer) because their `execution.allocation`
 * routes 100% of weight to one specific gauge — so the gauge weight
 * IS the strategy's footprint on the protocol. We CANNOT attribute
 * delegate-mode (Set & Forget) or multi-gauge (Balanced / Custom)
 * strategies from gauge weights alone: the same Stability Pool weight
 * could come from a balanced user with 40% there, a set-and-forget
 * user the optimizer routed there, or a custom user — gauge weight
 * is ambiguous about which strategy produced it. Those three
 * strategies are intentionally absent from this hook's `mix` array.
 * Their share will be computed by a future hook that reads
 * keeper-emitted VoteCast events keyed by the originating strategy.
 *
 * Source: on-chain `gauges()` + `gaugeMeta(gauge)` reads on the
 * deployed gauge controller. Pure — never invented.
 *
 * §14: no invented data. Below the 0.01 veMEZO noise floor, the hook
 * returns an empty mix so cards can hide the line rather than render
 * statistical noise from rounding.
 */

const NOISE_FLOOR_WEI = 10_000_000_000_000_000n; // 0.01 veMEZO

export type StrategyMixEntry = {
  strategyId: string;
  percent: number;
};

export type UseProtocolStrategyMixResult = {
  mix: StrategyMixEntry[];
  mostUsedStrategyId: string | null;
  totalVeMezoWei: bigint;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

/**
 * Build the gauge-name → strategy-id map. Names are lowercased so the
 * lookup is case-insensitive against `gaugeMeta` output. The three
 * single-gauge strategies in `presets.ts` (Stability Pool, MUSD Savings
 * Rate, BTC-MUSD LP) get a direct entry here; multi-gauge and
 * delegate-mode strategies are attributed elsewhere.
 *
 * STORY-005's preset list is `as const` and verified at compile time —
 * adding a new single-gauge preset requires extending this map (the test
 * suite catches the drift).
 */
void STRATEGY_PRESETS;
const NAME_TO_STRATEGY_ID: ReadonlyMap<string, string> = new Map([
  ["stability pool", "stability-max"],
  ["musd savings rate", "musd-saver"],
  ["btc-musd lp", "btc-lp-farmer"],
]);

export function useProtocolStrategyMix(): UseProtocolStrategyMixResult {
  // Read 1: the gauge address list from the gauge controller.
  // staleTime + gcTime cap the per-mount RPC storm: without them, every
  // StrategyGrid re-mount (route nav, modal open, etc.) fires N×2 reads
  // (one per gauge × 2 ABI calls each). 30s matches the rest of the
  // dApp's read cadence (useGaugeData, useLastVote, etc.); gauge
  // metadata changes at most on epoch boundaries.
  const list = useReadContracts({
    contracts: [
      {
        address: GAUGE_CONTROLLER_ADDRESS,
        abi: gaugeControllerAbi,
        functionName: "gauges",
      },
    ],
    query: { staleTime: 30_000, gcTime: 5 * 60_000 },
  });

  const addresses = (list.data?.[0]?.result as readonly Address[] | undefined) ?? [];

  // Read 2: per-gauge metadata. Two calls per gauge so the hook's
  // ABI surface can absorb a future per-gauge field (bribes, last-vote
  // timestamp) without reshaping the multi-call pipeline. The second
  // slot is `gaugeCount()` today — its value is ignored at composition
  // time; the test harness alternates `gaugeMeta` tuples with a sentinel
  // bigint on this slot.
  const meta = useReadContracts({
    query: { staleTime: 30_000, gcTime: 5 * 60_000 },
    contracts: addresses.flatMap((g) => [
      {
        address: GAUGE_CONTROLLER_ADDRESS,
        abi: gaugeControllerAbi,
        functionName: "gaugeMeta" as const,
        args: [g] as const,
      },
      {
        address: GAUGE_CONTROLLER_ADDRESS,
        abi: gaugeControllerAbi,
        functionName: "gaugeCount" as const,
      },
    ]),
  });

  const result = useMemo<UseProtocolStrategyMixResult>(() => {
    const isLoading = list.isLoading || meta.isLoading;
    const errorRaw = (list.error as Error | null) ?? (meta.error as Error | null);
    if (errorRaw) {
      return {
        mix: [],
        mostUsedStrategyId: null,
        totalVeMezoWei: 0n,
        isLoading: false,
        isError: true,
        error: errorRaw,
      };
    }
    if (isLoading) {
      return {
        mix: [],
        mostUsedStrategyId: null,
        totalVeMezoWei: 0n,
        isLoading: true,
        isError: false,
        error: null,
      };
    }

    type Tuple = readonly [string, bigint];
    const metaRows = (meta.data ?? []) as Array<{ result?: Tuple | bigint }>;

    let totalWei = 0n;
    const byStrategy = new Map<string, bigint>();

    for (let i = 0; i < metaRows.length; i += 2) {
      const tupleRow = metaRows[i]?.result;
      if (!Array.isArray(tupleRow) || tupleRow.length !== 2) continue;
      const [name, weiRaw] = tupleRow as unknown as readonly [string, bigint];
      const wei = typeof weiRaw === "bigint" ? weiRaw : BigInt(weiRaw ?? 0);
      totalWei += wei;
      const strategyId = NAME_TO_STRATEGY_ID.get(name.trim().toLowerCase());
      if (!strategyId) continue;
      byStrategy.set(strategyId, (byStrategy.get(strategyId) ?? 0n) + wei);
    }

    if (totalWei < NOISE_FLOOR_WEI || byStrategy.size === 0) {
      return {
        mix: [],
        mostUsedStrategyId: null,
        totalVeMezoWei: totalWei,
        isLoading: false,
        isError: false,
        error: null,
      };
    }

    // bigint → percent via *10_000 then back to number for 2-decimal
    // precision while staying lossless on the divide. Round to integer
    // percent at the surface — the UI line reads "47% of protocol veMEZO".
    const SCALE = 10_000n;
    const entries: StrategyMixEntry[] = [...byStrategy.entries()]
      .map(([strategyId, wei]) => ({
        strategyId,
        percent: Number((wei * SCALE) / totalWei) / 100,
      }))
      .sort((a, b) => b.percent - a.percent);

    // Round to nearest integer percent for display. Sum naturally
    // < 100 when unmapped gauges (delegate / multi-gauge strategies)
    // hold weight — that's the truth. Do NOT renormalize: Codex caught
    // a prior version inflating the top single-gauge strategy by adding
    // the unmapped slice back to it, which misrepresents the protocol
    // mix to anyone reading the UI as "X% of protocol veMEZO".
    const rounded = entries.map((e) => ({
      strategyId: e.strategyId,
      percent: Math.round(e.percent),
    }));

    return {
      mix: rounded,
      mostUsedStrategyId: rounded[0]?.strategyId ?? null,
      totalVeMezoWei: totalWei,
      isLoading: false,
      isError: false,
      error: null,
    };
  }, [list.data, list.isLoading, list.error, meta.data, meta.isLoading, meta.error]);

  return result;
}
