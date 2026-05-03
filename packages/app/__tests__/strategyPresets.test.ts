import { describe, it, expect } from "vitest";
import {
  STRATEGY_PRESETS,
  SET_AND_FORGET_ID,
  CUSTOM_ID,
} from "@/features/strategies/presets";
import { TOTAL_BPS } from "@/lib/optimize";
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

const ALL_GAUGES = [G_STAB, G_MUSD, G_BTC];

describe("strategy presets", () => {
  it("exports exactly 6 presets in stable order", () => {
    expect(STRATEGY_PRESETS).toHaveLength(6);
    expect(STRATEGY_PRESETS.map((p) => p.id)).toEqual([
      "set-and-forget",
      "stability-max",
      "musd-saver",
      "btc-lp-farmer",
      "balanced",
      "custom",
    ]);
  });

  it("Set & Forget is the only delegate-mode preset", () => {
    const delegate = STRATEGY_PRESETS.filter(
      (p) => p.execution.mode === "delegate",
    );
    expect(delegate).toHaveLength(1);
    expect(delegate[0].id).toBe(SET_AND_FORGET_ID);
  });

  it("Custom is the only custom-mode preset", () => {
    const custom = STRATEGY_PRESETS.filter(
      (p) => p.execution.mode === "custom",
    );
    expect(custom).toHaveLength(1);
    expect(custom[0].id).toBe(CUSTOM_ID);
  });

  it("Stability Max routes 100% to the Stability Pool gauge", () => {
    const p = STRATEGY_PRESETS.find((x) => x.id === "stability-max")!;
    if (p.execution.mode !== "manual") throw new Error("expected manual");
    const allocation = p.execution.allocation(ALL_GAUGES);
    expect(allocation).toEqual([
      { gauge: G_STAB.address, weightBps: TOTAL_BPS },
    ]);
  });

  it("MUSD Saver routes 100% to MUSD Savings Rate", () => {
    const p = STRATEGY_PRESETS.find((x) => x.id === "musd-saver")!;
    if (p.execution.mode !== "manual") throw new Error("expected manual");
    expect(p.execution.allocation(ALL_GAUGES)).toEqual([
      { gauge: G_MUSD.address, weightBps: TOTAL_BPS },
    ]);
  });

  it("BTC-LP Farmer routes 100% to BTC-MUSD LP", () => {
    const p = STRATEGY_PRESETS.find((x) => x.id === "btc-lp-farmer")!;
    if (p.execution.mode !== "manual") throw new Error("expected manual");
    expect(p.execution.allocation(ALL_GAUGES)).toEqual([
      { gauge: G_BTC.address, weightBps: TOTAL_BPS },
    ]);
  });

  it("Balanced 40/30/30 splits across the three gauges and sums to 10000", () => {
    const p = STRATEGY_PRESETS.find((x) => x.id === "balanced")!;
    if (p.execution.mode !== "manual") throw new Error("expected manual");
    const allocation = p.execution.allocation(ALL_GAUGES);
    expect(allocation).toHaveLength(3);
    const total = allocation.reduce((acc, e) => acc + e.weightBps, 0);
    expect(total).toBe(TOTAL_BPS);
    const byAddr = Object.fromEntries(
      allocation.map((e) => [e.gauge, e.weightBps]),
    );
    expect(byAddr[G_STAB.address]).toBe(4000);
    expect(byAddr[G_MUSD.address]).toBe(3000);
    expect(byAddr[G_BTC.address]).toBe(3000);
  });

  it("static presets renormalize to 10000 when a configured gauge is missing", () => {
    // Drop the BTC gauge — the remaining 4000 + 3000 = 7000 must scale
    // up to 10000 so the on-chain _checkWeights passes.
    const p = STRATEGY_PRESETS.find((x) => x.id === "balanced")!;
    if (p.execution.mode !== "manual") throw new Error("expected manual");
    const allocation = p.execution.allocation([G_STAB, G_MUSD]);
    expect(allocation).toHaveLength(2);
    const total = allocation.reduce((acc, e) => acc + e.weightBps, 0);
    expect(total).toBe(TOTAL_BPS);
  });

  it("static presets return empty allocation when the named gauge is absent", () => {
    const p = STRATEGY_PRESETS.find((x) => x.id === "stability-max")!;
    if (p.execution.mode !== "manual") throw new Error("expected manual");
    expect(p.execution.allocation([G_MUSD, G_BTC])).toEqual([]);
  });

  it("static presets return empty allocation when no gauges are loaded", () => {
    for (const p of STRATEGY_PRESETS) {
      if (p.execution.mode !== "manual") continue;
      expect(p.execution.allocation([])).toEqual([]);
    }
  });
});
