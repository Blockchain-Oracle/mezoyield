import { describe, it, expect } from "vitest";
import { computeApy } from "@/lib/subgraph";

/**
 * Pure-function lock-in for the APY math from story-005:
 *   apy = (bribeMUSDWei / totalVeMezoWei) * 52 * 100  (percent)
 */
describe("computeApy", () => {
  const ONE = 10n ** 18n;

  it("returns null when totalVeMezo is zero (uninhabited gauge)", () => {
    expect(computeApy(100n * ONE, 0n)).toBeNull();
  });

  it("computes 5_200 MUSD bribe / 6_700_000 veMEZO * 52 → ~4.0%", () => {
    // Matches the BTC-MUSD LP seed values in scripts/deploy.ts.
    const bribe = 5_200n * ONE;
    const total = 6_700_000n * ONE;
    const apy = computeApy(bribe, total);
    expect(apy).not.toBeNull();
    // (5200/6700000)*52*100 = 4.0358... → rounded to 1 decimal
    expect(apy).toBeCloseTo(4.0, 1);
  });

  it("rounds to 1 decimal place per the dashboard rendering rule", () => {
    const bribe = 1_000n * ONE;
    const total = 1_000_000n * ONE;
    // ratio = 0.001, *52*100 = 5.2
    expect(computeApy(bribe, total)).toBe(5.2);
  });

  it("handles a 0 bribe → 0% APY (gauge with no incentives this epoch)", () => {
    expect(computeApy(0n, 1_000_000n * ONE)).toBe(0);
  });
});
