"use client";

import { useMemo } from "react";
import {
  STRATEGY_PRESETS,
  autoAllocate,
  type StrategyPreset,
} from "@/features/strategies/presets";
import { estimateWeeklyMusdWei } from "@/lib/optimize";
import type { Gauge } from "@/lib/types";

const SIMULATION_WEEKS = 8;

export type SimulationRow = {
  preset: StrategyPreset;
  weeklyWei: bigint;
  totalWei: bigint;
};

/**
 * "Had you run each strategy for the last 8 weeks against your
 * current veMEZO balance, here's what you would have earned."
 *
 * Honest framing: this assumes the CURRENT gauge state has been
 * stable for the past 8 epochs (we don't have historical bribe
 * snapshots without a subgraph indexer). It's a forward-looking
 * proxy — useful for comparing strategies, not a literal backfill.
 *
 * Skip the Custom strategy (no static allocation to compute) and
 * skip Set & Forget if no gauges have bribes (autoAllocate would
 * fall back to highest-totalVeMezo, which would skew the comparison).
 */
export function useSimulation(
  userBalanceWei: bigint,
  gauges: Gauge[],
  weeks: number = SIMULATION_WEEKS,
): { rows: SimulationRow[]; weeks: number } {
  const rows = useMemo<SimulationRow[]>(() => {
    if (userBalanceWei === 0n || gauges.length === 0) return [];
    const out: SimulationRow[] = [];
    for (const preset of STRATEGY_PRESETS) {
      if (preset.execution.mode === "custom") continue;
      const allocation =
        preset.execution.mode === "delegate"
          ? autoAllocate(gauges)
          : preset.execution.allocation(gauges);
      if (allocation.length === 0) continue;
      const weeklyWei = estimateWeeklyMusdWei(
        userBalanceWei,
        allocation,
        gauges,
      );
      out.push({
        preset,
        weeklyWei,
        totalWei: weeklyWei * BigInt(weeks),
      });
    }
    // Sort by total descending so the winner sits at the top.
    out.sort((a, b) =>
      b.totalWei > a.totalWei ? 1 : b.totalWei < a.totalWei ? -1 : 0,
    );
    return out;
  }, [userBalanceWei, gauges, weeks]);

  return { rows, weeks };
}
