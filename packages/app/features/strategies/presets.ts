import type { Gauge } from "@/lib/types";
import { type AllocationEntry, autoAllocate, TOTAL_BPS } from "@/lib/optimize";

/**
 * The 6 strategy presets users browse and pick on /app/strategies.
 *
 * Two execution modes:
 *
 *  - "delegate": user calls `delegate(user)` on the optimizer. The
 *    keeper bot then re-votes their power each epoch via
 *    `castOptimalVote()`. Set & Forget is the only delegate strategy.
 *
 *  - "manual": user calls `setManualAllocation(gauges, weights)` with
 *    weights computed by the strategy's `allocation` function from the
 *    live gauge data. The vote stays static across epochs unless the
 *    user re-activates a different strategy.
 *
 * "Custom" is a UI special-case: clicking it routes to the manual
 * editor (sliders) instead of opening the standard activate-modal flow.
 *
 * Gauge lookup is by NAME, not address, so a redeploy with new
 * addresses doesn't break the strategies — the seeded gauges keep the
 * same human names ("Stability Pool" / "MUSD Savings Rate" / "BTC-MUSD LP").
 */

export type RiskTone = "low" | "medium" | "high" | "neutral";

export type StrategyExecution =
  | { mode: "delegate" }
  | { mode: "manual"; allocation: (gauges: Gauge[]) => AllocationEntry[] }
  | { mode: "custom" };

export type StrategyPreset = {
  id: string;
  name: string;
  /** One-paragraph plain-English description (no jargon, no addresses). */
  description: string;
  /** Short "what you get" tagline shown on the card. */
  tagline: string;
  /** Display string. */
  riskLabel: string;
  riskTone: RiskTone;
  execution: StrategyExecution;
};

/** Find a gauge by case-insensitive name. */
function findGauge(gauges: Gauge[], name: string): Gauge | undefined {
  const target = name.toLowerCase();
  return gauges.find((g) => g.name.toLowerCase() === target);
}

/** Build a single-gauge 100% allocation. Empty array if the gauge isn't loaded. */
function singleGauge(name: string) {
  return (gauges: Gauge[]): AllocationEntry[] => {
    const g = findGauge(gauges, name);
    if (!g) return [];
    return [{ gauge: g.address, weightBps: TOTAL_BPS }];
  };
}

/**
 * Build a fixed-weight multi-gauge allocation. The `weights` map is
 * `{ "Gauge Name": basisPoints }`. Sums must equal TOTAL_BPS.
 *
 * Gauges absent from the live `gauges[]` are skipped. The remaining
 * gauges' weights are renormalized so the on-chain `_checkWeights`
 * (sum == 10_000) check still passes — partial gauge data shouldn't
 * brick the strategy mid-demo.
 */
function fixedWeights(weights: Record<string, number>) {
  return (gauges: Gauge[]): AllocationEntry[] => {
    const entries: AllocationEntry[] = [];
    for (const [name, bps] of Object.entries(weights)) {
      const g = findGauge(gauges, name);
      if (!g) continue;
      entries.push({ gauge: g.address, weightBps: bps });
    }
    if (entries.length === 0) return [];
    const sum = entries.reduce((acc, e) => acc + e.weightBps, 0);
    if (sum === TOTAL_BPS) return entries;
    // Renormalize when at least one configured gauge is missing.
    const scaled = entries.map((e) => ({
      gauge: e.gauge,
      weightBps: Math.floor((e.weightBps * TOTAL_BPS) / sum),
    }));
    const drift = TOTAL_BPS - scaled.reduce((acc, e) => acc + e.weightBps, 0);
    if (drift !== 0 && scaled.length > 0) scaled[0].weightBps += drift;
    return scaled;
  };
}

export const STRATEGY_PRESETS: readonly StrategyPreset[] = [
  {
    id: "set-and-forget",
    name: "Set & Forget",
    tagline: "MezoYield votes for you each epoch",
    description:
      "MezoYield votes for the highest-APY gauge for you each epoch. Re-balances automatically every Sunday. You never have to come back unless you want to claim rewards or change strategy.",
    riskLabel: "Medium",
    riskTone: "medium",
    execution: { mode: "delegate" },
  },
  {
    id: "stability-max",
    name: "Stability Max",
    tagline: "100% to the protocol's safest pool",
    description:
      "All of your votes go to the Stability Pool gauge. Predictable yield anchored by Mezo's most conservative pool. No LP exposure, no impermanent loss.",
    riskLabel: "Lowest",
    riskTone: "low",
    execution: { mode: "manual", allocation: singleGauge("Stability Pool") },
  },
  {
    id: "musd-saver",
    name: "MUSD Saver",
    tagline: "100% to the MUSD Savings Rate gauge",
    description:
      "All of your votes go to the MUSD Savings Rate gauge. Earns the MUSD interest-rate distribution with no LP exposure. A clean way to long the MUSD savings yield.",
    riskLabel: "Low",
    riskTone: "low",
    execution: { mode: "manual", allocation: singleGauge("MUSD Savings Rate") },
  },
  {
    id: "btc-lp-farmer",
    name: "BTC-LP Farmer",
    tagline: "100% to the BTC-MUSD liquidity pool",
    description:
      "All of your votes go to the BTC-MUSD LP gauge. Highest current APY in the seeded set, with exposure to LP impermanent loss when BTC moves vs MUSD.",
    riskLabel: "Highest",
    riskTone: "high",
    execution: { mode: "manual", allocation: singleGauge("BTC-MUSD LP") },
  },
  {
    id: "balanced",
    name: "Balanced 40/30/30",
    tagline: "Diversified across all three gauges",
    description:
      "40% Stability Pool, 30% MUSD Savings Rate, 30% BTC-MUSD LP. Diversified across the three core gauges so no single one drags down your epoch.",
    riskLabel: "Medium",
    riskTone: "medium",
    execution: {
      mode: "manual",
      allocation: fixedWeights({
        "Stability Pool": 4000,
        "MUSD Savings Rate": 3000,
        "BTC-MUSD LP": 3000,
      }),
    },
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Pick your own gauges and weights",
    description:
      "Use the manual editor to assign your own weights across any combination of gauges. Total must sum to 100%. For users who want fine-grained control over their allocation.",
    riskLabel: "Self-determined",
    riskTone: "neutral",
    execution: { mode: "custom" },
  },
] as const;

export const SET_AND_FORGET_ID = "set-and-forget";
export const CUSTOM_ID = "custom";

/** Re-export for the activation hook so callers can preview without importing autoAllocate. */
export { autoAllocate, type AllocationEntry };
