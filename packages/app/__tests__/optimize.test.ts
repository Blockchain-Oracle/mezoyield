import { describe, it, expect } from "vitest";
import {
  autoAllocate,
  estimateWeeklyMusdWei,
  summarizeManualAllocation,
  TOTAL_BPS,
} from "@/lib/optimize";
import type { Gauge, Address } from "@/lib/types";

const G = (
  hex: string,
  name: string,
  totalVeMezo: bigint,
  bribe: bigint,
): Gauge => ({
  address: hex as Address,
  name,
  totalVeMezoWei: totalVeMezo,
  bribeMUSDWei: bribe,
  apyPercent: null,
});

const ONE = 10n ** 18n;

/**
 * Pure-function lock-in for the STORY-007 optimization algorithm:
 *   1. Score = bribe / total veMEZO (annualization × 52 cancels in ranking).
 *   2. Sort by score desc.
 *   3. Allocate weights proportional to score, summing to TOTAL_BPS exactly.
 */
describe("autoAllocate", () => {
  it("returns an empty allocation when no gauges are passed", () => {
    expect(autoAllocate([])).toEqual([]);
  });

  it("returns a single 100% allocation when only one gauge has bribes", () => {
    const gauges = [
      G("0xa1", "A", 1_000_000n * ONE, 100n * ONE),
      G("0xa2", "B", 1_000_000n * ONE, 0n), // no bribe → score 0
    ];
    const result = autoAllocate(gauges);
    expect(result.map((e) => e.gauge)).toEqual(["0xa1"]);
    expect(result[0].weightBps).toBe(TOTAL_BPS);
  });

  it("ranks higher-bribe-per-veMezo gauges first", () => {
    const gauges = [
      G("0xa1", "Lower", 10_000_000n * ONE, 1_000n * ONE),
      G("0xa2", "Higher", 1_000_000n * ONE, 1_000n * ONE),
    ];
    const result = autoAllocate(gauges);
    // 0xa2 has 10x the score (same bribe, 1/10 the total veMEZO).
    expect(result[0].gauge).toBe("0xa2");
    expect(result[0].weightBps).toBeGreaterThan(result[1].weightBps);
  });

  it("always sums weights to exactly TOTAL_BPS regardless of rounding", () => {
    const gauges = [
      G("0xa1", "A", 333_333n * ONE, 100n * ONE),
      G("0xa2", "B", 444_444n * ONE, 100n * ONE),
      G("0xa3", "C", 555_555n * ONE, 100n * ONE),
    ];
    const result = autoAllocate(gauges);
    const sum = result.reduce((acc, e) => acc + e.weightBps, 0);
    expect(sum).toBe(TOTAL_BPS);
  });

  it("falls back to highest-totalVeMezo when no gauge has bribes", () => {
    const gauges = [
      G("0xa1", "Smaller", 100_000n * ONE, 0n),
      G("0xa2", "Largest", 1_000_000n * ONE, 0n),
      G("0xa3", "Medium", 500_000n * ONE, 0n),
    ];
    const result = autoAllocate(gauges);
    expect(result).toHaveLength(1);
    expect(result[0].gauge).toBe("0xa2");
    expect(result[0].weightBps).toBe(TOTAL_BPS);
  });

  it("ignores gauges with zero totalVeMezo (avoid divide-by-zero)", () => {
    const gauges = [
      G("0xa1", "Live", 1_000_000n * ONE, 100n * ONE),
      G("0xa2", "Empty", 0n, 100n * ONE), // hypothetical: bribe with zero stake
    ];
    const result = autoAllocate(gauges);
    expect(result.map((e) => e.gauge)).toEqual(["0xa1"]);
  });
});

describe("estimateWeeklyMusdWei", () => {
  it("returns 0 for zero balance", () => {
    expect(
      estimateWeeklyMusdWei(0n, [{ gauge: "0xa1" as Address, weightBps: TOTAL_BPS }], [
        G("0xa1", "A", 1n * ONE, 1n * ONE),
      ]),
    ).toBe(0n);
  });

  it("computes 1500 veMEZO at 100% on a 1M-total / 1k-bribe gauge → 1.5 MUSD", () => {
    const result = estimateWeeklyMusdWei(
      1500n * ONE,
      [{ gauge: "0xa1" as Address, weightBps: TOTAL_BPS }],
      [G("0xa1", "A", 1_000_000n * ONE, 1_000n * ONE)],
    );
    expect(result).toBe(1500n * ONE * 1_000n / 1_000_000n);
  });

  it("ignores allocation entries that don't match a known gauge", () => {
    const result = estimateWeeklyMusdWei(
      1n * ONE,
      [
        { gauge: "0xa1" as Address, weightBps: 5_000 },
        { gauge: "0xunknown" as Address, weightBps: 5_000 },
      ],
      [G("0xa1", "A", 1n * ONE, 1n * ONE)],
    );
    // Only 50% of veMEZO matters: share = 0.5 * 1 = 0.5; reward = 0.5 * 1 / 1 = 0.5
    expect(result).toBe(ONE / 2n);
  });
});

describe("summarizeManualAllocation", () => {
  it("flags valid when sum is exactly TOTAL_BPS", () => {
    const r = summarizeManualAllocation([
      { gauge: "0xa1" as Address, weightBps: 6_000 },
      { gauge: "0xa2" as Address, weightBps: 4_000 },
    ]);
    expect(r.totalBps).toBe(TOTAL_BPS);
    expect(r.isValid).toBe(true);
  });

  it("flags invalid when sum is off-target", () => {
    const r = summarizeManualAllocation([
      { gauge: "0xa1" as Address, weightBps: 6_000 },
      { gauge: "0xa2" as Address, weightBps: 3_999 },
    ]);
    expect(r.totalBps).toBe(9_999);
    expect(r.isValid).toBe(false);
  });

  it("treats empty allocation as invalid (zero != 10000)", () => {
    expect(summarizeManualAllocation([]).isValid).toBe(false);
  });
});
