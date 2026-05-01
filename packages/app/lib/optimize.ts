import type { Gauge, Address } from "@/lib/types";

/**
 * Pure allocation algorithm — STORY-007.
 *
 * Per the spec:
 *   1. score(g) = (g.bribeMUSDWei / g.totalVeMezoWei). Annualized doesn't
 *      change relative ranking (×52 cancels), so we operate on the raw ratio.
 *   2. Sort gauges by score descending.
 *   3. Take all gauges with score > 0 (incentivized this epoch). If none,
 *      we fall back to picking the highest-totalVeMezo gauge so the user
 *      isn't left with an empty allocation when the bribe board is empty.
 *   4. Distribute weights proportionally to score. Round to integer
 *      basis points; fix the rounding drift on the heaviest entry so the
 *      sum is exactly 10_000.
 *
 * Deterministic and pure. No on-chain calls; the hook supplies the
 * Gauge[] from useGaugeData. §14: no synthesized data.
 */
export type AllocationEntry = {
  gauge: Address;
  weightBps: number;
};

export const TOTAL_BPS = 10_000;

export function autoAllocate(gauges: Gauge[]): AllocationEntry[] {
  if (gauges.length === 0) return [];

  // Score = bribe / totalVeMezo, kept in bigint as a fixed-point ratio
  // scaled by 1e18 so we don't lose precision on small ratios. Codex P2
  // on PR #24 caught that scaling to a plain number (1e9) and filtering
  // `score > 0` would truncate any positive bribe with ratio < 1e-9 to
  // zero — possible on large-veMEZO/small-bribe gauges. bigint arithmetic
  // through to the final BPS conversion avoids the precision cliff.
  const SCALE = 10n ** 18n;
  const scored = gauges
    .map((g) => ({
      gauge: g,
      score:
        g.totalVeMezoWei === 0n ? 0n : (g.bribeMUSDWei * SCALE) / g.totalVeMezoWei,
    }))
    .filter((x) => x.score > 0n)
    .sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));

  if (scored.length === 0) {
    // Fallback: pick the gauge with highest totalVeMezo so the user has a
    // valid 100% allocation even when no bribes are posted this epoch.
    const fallback = [...gauges].sort((a, b) =>
      a.totalVeMezoWei < b.totalVeMezoWei
        ? 1
        : a.totalVeMezoWei > b.totalVeMezoWei
          ? -1
          : 0,
    )[0];
    return [{ gauge: fallback.address, weightBps: TOTAL_BPS }];
  }

  const totalScore = scored.reduce((acc, x) => acc + x.score, 0n);
  const totalBpsBig = BigInt(TOTAL_BPS);
  // Floor each weight (bigint division IS floor for positive operands),
  // then redistribute the rounding drift onto the heaviest entry so the
  // final sum is exactly TOTAL_BPS.
  const entries = scored.map((x) => ({
    gauge: x.gauge.address,
    weightBps: Number((x.score * totalBpsBig) / totalScore),
  }));
  const drift = TOTAL_BPS - entries.reduce((acc, e) => acc + e.weightBps, 0);
  if (drift !== 0 && entries.length > 0) {
    entries[0].weightBps += drift;
  }
  return entries;
}

/**
 * Estimate the user's weekly MUSD reward from a candidate allocation
 * against the live gauge state. Same shape as PositionCard's existing
 * estimate, exposed here so the OptimizeModal preview can show the
 * "Estimated MUSD/week: X" line.
 */
export function estimateWeeklyMusdWei(
  userVeMezoWei: bigint,
  allocation: AllocationEntry[],
  gauges: Gauge[],
): bigint {
  if (userVeMezoWei === 0n || allocation.length === 0 || gauges.length === 0) return 0n;
  let total = 0n;
  for (const entry of allocation) {
    const g = gauges.find((x) => x.address.toLowerCase() === entry.gauge.toLowerCase());
    if (!g || g.totalVeMezoWei === 0n) continue;
    const shareWei = (userVeMezoWei * BigInt(entry.weightBps)) / BigInt(TOTAL_BPS);
    const rewardWei = (shareWei * g.bribeMUSDWei) / g.totalVeMezoWei;
    total += rewardWei;
  }
  return total;
}

/**
 * Validate a manual-mode allocation: weights must sum to TOTAL_BPS.
 * Returns the running sum + a boolean for the UI to gate the submit
 * button on.
 */
export function summarizeManualAllocation(entries: AllocationEntry[]): {
  totalBps: number;
  isValid: boolean;
} {
  const totalBps = entries.reduce((acc, e) => acc + e.weightBps, 0);
  return { totalBps, isValid: totalBps === TOTAL_BPS };
}
