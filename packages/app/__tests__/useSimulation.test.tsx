import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSimulation } from "@/features/simulator/useSimulation";
import type { Gauge, Address } from "@/lib/types";

const G_STAB: Gauge = {
  address: "0x0000000000000000000000000000000000000001" as Address,
  name: "Stability Pool",
  totalVeMezoWei: 12_500_000n * 10n ** 18n,
  bribeMUSDWei: 8_400n * 10n ** 18n,
  apyPercent: 3.5,
};
const G_MUSD: Gauge = {
  address: "0x0000000000000000000000000000000000000002" as Address,
  name: "MUSD Savings Rate",
  totalVeMezoWei: 9_200_000n * 10n ** 18n,
  bribeMUSDWei: 4_500n * 10n ** 18n,
  apyPercent: 2.5,
};
const G_BTC: Gauge = {
  address: "0x0000000000000000000000000000000000000003" as Address,
  name: "BTC-MUSD LP",
  totalVeMezoWei: 6_700_000n * 10n ** 18n,
  bribeMUSDWei: 5_200n * 10n ** 18n,
  apyPercent: 4.0,
};
const ALL = [G_STAB, G_MUSD, G_BTC];

const VE_MEZO_1K = 1_000n * 10n ** 18n;

describe("useSimulation", () => {
  it("returns no rows when balance is zero", () => {
    const { result } = renderHook(() => useSimulation(0n, ALL));
    expect(result.current.rows).toEqual([]);
  });

  it("returns no rows when no gauges loaded", () => {
    const { result } = renderHook(() => useSimulation(VE_MEZO_1K, []));
    expect(result.current.rows).toEqual([]);
  });

  it("skips Custom (no static allocation to compute)", () => {
    const { result } = renderHook(() => useSimulation(VE_MEZO_1K, ALL));
    expect(
      result.current.rows.find((r) => r.preset.id === "custom"),
    ).toBeUndefined();
  });

  it("returns rows for the 5 non-custom presets", () => {
    const { result } = renderHook(() => useSimulation(VE_MEZO_1K, ALL));
    const ids = result.current.rows.map((r) => r.preset.id).sort();
    expect(ids).toEqual([
      "balanced",
      "btc-lp-farmer",
      "musd-saver",
      "set-and-forget",
      "stability-max",
    ]);
  });

  it("sorts rows descending by total earned", () => {
    const { result } = renderHook(() => useSimulation(VE_MEZO_1K, ALL));
    for (let i = 1; i < result.current.rows.length; i++) {
      expect(result.current.rows[i - 1].totalWei).toBeGreaterThanOrEqual(
        result.current.rows[i].totalWei,
      );
    }
  });

  it("totalWei equals weeklyWei × weeks (default 8)", () => {
    const { result } = renderHook(() => useSimulation(VE_MEZO_1K, ALL));
    for (const r of result.current.rows) {
      expect(r.totalWei).toBe(r.weeklyWei * 8n);
    }
    expect(result.current.weeks).toBe(8);
  });

  it("BTC-LP Farmer wins on this gauge fixture (highest bribe/totalVeMezo ratio)", () => {
    const { result } = renderHook(() => useSimulation(VE_MEZO_1K, ALL));
    expect(result.current.rows[0].preset.id).toBe("btc-lp-farmer");
  });
});
