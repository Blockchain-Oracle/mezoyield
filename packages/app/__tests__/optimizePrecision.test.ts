import { describe, it, expect } from "vitest";
import { autoAllocate } from "@/lib/optimize";
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
 * Codex P2 regression on PR #24: with the previous Number(scaled) / 1e9
 * truncation, a positive bribe ratio < 1e-9 collapsed to 0 and got
 * filtered out, falling back to "highest TVL" allocation even though
 * incentives existed. The bigint score path preserves precision.
 */
describe("autoAllocate precision (Codex P2 lock-in)", () => {
  it("preserves a small bribe (1 wei against 1e18-total) that the old code would have truncated to zero", () => {
    // Old code: Number((1 * 1e9) / 1e18) === Number(0n) === 0 → filtered out
    //           and the function fell back to "highest TVL" instead of using
    //           the actual incentive. This is the exact case Codex flagged.
    // New bigint scoring: score = 1 * 1e18 / 1e18 = 1n > 0n → kept.
    const small = G("0xa1", "Small", 10n ** 18n, 1n);
    const result = autoAllocate([small]);
    expect(result).toHaveLength(1);
    expect(result[0].gauge).toBe(small.address);
    expect(result[0].weightBps).toBe(10_000);
  });

  it("ranks two gauges with small-but-distinguishable ratios correctly", () => {
    // A: ratio = 100/1e18 (= 1e-16); B: ratio = 50/1e18 (= 5e-17).
    // Old code: both score = Number((bribe * 1e9) / 1e18) = 0 → both dropped.
    // New code: A.score = 100, B.score = 50 → A first, sum = 10_000.
    const A = G("0xaaa1", "A", 10n ** 18n, 100n);
    const B = G("0xbbb2", "B", 10n ** 18n, 50n);
    const result = autoAllocate([A, B]);
    expect(result).toHaveLength(2);
    expect(result[0].gauge).toBe("0xaaa1");
    expect(result[1].gauge).toBe("0xbbb2");
    expect(result[0].weightBps + result[1].weightBps).toBe(10_000);
    expect(result[0].weightBps).toBeGreaterThan(result[1].weightBps);
  });

  it("preserves ranking on the realistic seeded gauge profile", () => {
    // Mirror the deploy script's seed. APYs differ by ~1.5x; ranking should
    // reflect that.
    const sp = G("0xaaa1", "Stability Pool", 12_500_000n * ONE, 8_400n * ONE);
    const sr = G("0xaaa2", "MUSD Savings Rate", 9_200_000n * ONE, 4_500n * ONE);
    const lp = G("0xaaa3", "BTC-MUSD LP", 6_700_000n * ONE, 5_200n * ONE);
    const result = autoAllocate([sp, sr, lp]);
    // BTC-MUSD LP has best ratio (5200/6.7M ≈ 776e-6), then SP (672e-6), then SR (489e-6).
    expect(result.map((e) => e.gauge)).toEqual(["0xaaa3", "0xaaa1", "0xaaa2"]);
    expect(result.reduce((acc, e) => acc + e.weightBps, 0)).toBe(10_000);
  });
});
