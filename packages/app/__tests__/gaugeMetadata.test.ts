import { describe, it, expect } from "vitest";
import { deriveGaugeDisplay } from "@/lib/gaugeMetadata";

/**
 * Locks the gauge-name parser so we don't quietly mis-classify a gauge
 * when Mezo seeds a new pair. Names follow the convention:
 *
 *   TOKENA/TOKENB-FEETIER   → CL pool, fee tier suffix decides "CL" prefix
 *   TOKENA/TOKENB           → Basic pool, no fee tier
 *   "* Savings"             → Savings vault, single-token
 *   "Stability Pool"        → Stability Pool, single-token (MUSD)
 *
 * Stable-only pairs (both sides in MUSD/mUSDC/mUSDT/USDC/USDT) get the
 * "stable pool" subtype; anything else is "volatile".
 */
describe("deriveGaugeDisplay", () => {
  it("parses CL stable pool: mUSDC/MUSD-10", () => {
    const d = deriveGaugeDisplay("mUSDC/MUSD-10");
    expect(d.tokens).toEqual(["mUSDC", "MUSD"]);
    expect(d.poolType).toBe("CL stable pool");
  });

  it("parses CL volatile pool: BTC/MEZO-2000", () => {
    const d = deriveGaugeDisplay("BTC/MEZO-2000");
    expect(d.tokens).toEqual(["BTC", "MEZO"]);
    expect(d.poolType).toBe("CL volatile pool");
  });

  it("parses Basic stable pool: mUSDC/MUSD (no fee tier)", () => {
    const d = deriveGaugeDisplay("mUSDC/MUSD");
    expect(d.tokens).toEqual(["mUSDC", "MUSD"]);
    expect(d.poolType).toBe("Basic stable pool");
  });

  it("parses Basic volatile pool: mcbBTC/BTC", () => {
    const d = deriveGaugeDisplay("mcbBTC/BTC");
    expect(d.tokens).toEqual(["mcbBTC", "BTC"]);
    expect(d.poolType).toBe("Basic volatile pool");
  });

  it("parses Savings vault for MUSD Savings", () => {
    const d = deriveGaugeDisplay("MUSD Savings");
    expect(d.tokens).toEqual(["MUSD"]);
    expect(d.poolType).toBe("Savings vault");
  });

  it("parses Stability Pool single-token", () => {
    const d = deriveGaugeDisplay("Stability Pool");
    expect(d.tokens).toEqual(["MUSD"]);
    expect(d.poolType).toBe("Stability Pool");
  });

  it("falls back gracefully on an unrecognized token symbol", () => {
    const d = deriveGaugeDisplay("FOO/BAR");
    expect(d.tokens).toEqual(["UNKNOWN", "UNKNOWN"]);
    expect(d.poolType).toBe("Basic volatile pool");
  });
});
