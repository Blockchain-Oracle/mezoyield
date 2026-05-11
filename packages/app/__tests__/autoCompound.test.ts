import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeSplit, readAutoCompoundPct } from "@/lib/autoCompound";

describe("computeSplit", () => {
  it("0% routes everything to the wallet", () => {
    const s = computeSplit(100n * 10n ** 18n, 0);
    expect(s.walletWei).toBe(100n * 10n ** 18n);
    expect(s.compoundWei).toBe(0n);
    expect(s.pct).toBe(0);
  });

  it("100% routes everything to compound", () => {
    const s = computeSplit(100n * 10n ** 18n, 100);
    expect(s.walletWei).toBe(0n);
    expect(s.compoundWei).toBe(100n * 10n ** 18n);
  });

  it("50% splits down the middle", () => {
    const s = computeSplit(100n * 10n ** 18n, 50);
    expect(s.walletWei).toBe(50n * 10n ** 18n);
    expect(s.compoundWei).toBe(50n * 10n ** 18n);
  });

  it("preserves total — wallet + compound === pending", () => {
    for (const pct of [0, 13, 17, 50, 67, 100]) {
      const pending = 12345678901234567890n;
      const s = computeSplit(pending, pct);
      expect(s.walletWei + s.compoundWei).toBe(pending);
    }
  });

  it("clamps negative pct to 0", () => {
    const s = computeSplit(100n * 10n ** 18n, -25);
    expect(s.pct).toBe(0);
    expect(s.walletWei).toBe(100n * 10n ** 18n);
  });

  it("clamps pct > 100 to 100", () => {
    const s = computeSplit(100n * 10n ** 18n, 250);
    expect(s.pct).toBe(100);
    expect(s.compoundWei).toBe(100n * 10n ** 18n);
  });

  it("rounds fractional pct to nearest integer (defensive against hand-edited storage)", () => {
    const s = computeSplit(100n * 10n ** 18n, 49.6);
    expect(s.pct).toBe(50);
  });

  it("works on zero pending without divide-by-zero", () => {
    const s = computeSplit(0n, 50);
    expect(s.walletWei).toBe(0n);
    expect(s.compoundWei).toBe(0n);
  });
});

describe("readAutoCompoundPct", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0 when nothing is saved", () => {
    expect(readAutoCompoundPct()).toBe(0);
  });

  it("reads the saved value from the v1 settings key", () => {
    window.localStorage.setItem(
      "mezoyield:settings:v1",
      JSON.stringify({ autoCompoundPct: 35 }),
    );
    expect(readAutoCompoundPct()).toBe(35);
  });

  it("returns 0 on malformed JSON instead of throwing", () => {
    window.localStorage.setItem("mezoyield:settings:v1", "{not-json");
    expect(readAutoCompoundPct()).toBe(0);
  });

  it("returns 0 when the field is missing or non-numeric", () => {
    window.localStorage.setItem(
      "mezoyield:settings:v1",
      JSON.stringify({ autoCompoundPct: "fifty" }),
    );
    expect(readAutoCompoundPct()).toBe(0);
  });

  it("clamps a hand-edited pct outside [0,100]", () => {
    window.localStorage.setItem(
      "mezoyield:settings:v1",
      JSON.stringify({ autoCompoundPct: 9001 }),
    );
    expect(readAutoCompoundPct()).toBe(100);
    window.localStorage.setItem(
      "mezoyield:settings:v1",
      JSON.stringify({ autoCompoundPct: -10 }),
    );
    expect(readAutoCompoundPct()).toBe(0);
  });
});
