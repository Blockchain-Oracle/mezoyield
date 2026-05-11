import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Protocol-aggregate strategy distribution. Returns the share of total
 * veMEZO routed through each strategy preset (Set & Forget, Stability
 * Max, MUSD Saver, etc.). The "most used" strategy is the one with the
 * largest share.
 *
 * Source: cross-account `VoteCast` events on the optimizer, attributed
 * to the strategy that produced them. Pure on-chain — never invented.
 * When the protocol total is below the noise floor (< 0.01 veMEZO total),
 * the hook returns an empty array so cards can hide the line.
 */

const wagmiState: {
  list: { data?: unknown; isLoading: boolean; error: Error | null };
  meta: { data?: unknown; isLoading: boolean; error: Error | null };
} = {
  list: { data: undefined, isLoading: false, error: null },
  meta: { data: undefined, isLoading: false, error: null },
};

vi.mock("wagmi", () => ({
  useReadContracts: (() => {
    let n = 0;
    return () => {
      const i = n % 2;
      n += 1;
      return i === 0 ? wagmiState.list : wagmiState.meta;
    };
  })(),
}));

import { useProtocolStrategyMix } from "@/hooks/useProtocolStrategyMix";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useProtocolStrategyMix", () => {
  beforeEach(() => {
    wagmiState.list = { data: undefined, isLoading: false, error: null };
    wagmiState.meta = { data: undefined, isLoading: false, error: null };
  });

  it("Given no gauges loaded, When the hook resolves, Then it returns an empty mix + zero total", async () => {
    wagmiState.list = { data: [{ result: [] }], isLoading: false, error: null };
    const { result } = renderHook(() => useProtocolStrategyMix(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalVeMezoWei).toBe(0n);
    expect(result.current.mix).toEqual([]);
    expect(result.current.mostUsedStrategyId).toBeNull();
  });

  it("Given gauges with real veMEZO weights, When the hook resolves, Then percentages sum to ~100 and mostUsed is largest", async () => {
    const A = "0xaaa0000000000000000000000000000000000001";
    const B = "0xbbb0000000000000000000000000000000000002";
    const C = "0xccc0000000000000000000000000000000000003";
    wagmiState.list = { data: [{ result: [A, B, C] }], isLoading: false, error: null };
    wagmiState.meta = {
      data: [
        { result: ["Stability Pool", 12_000_000n * 10n ** 18n] },
        { result: 0n },
        { result: ["MUSD Savings Rate", 9_000_000n * 10n ** 18n] },
        { result: 0n },
        { result: ["BTC-MUSD LP", 4_000_000n * 10n ** 18n] },
        { result: 0n },
      ],
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useProtocolStrategyMix(), { wrapper });
    await waitFor(() => expect(result.current.mix.length).toBeGreaterThan(0));

    // Sum of all weights ~ 25M veMEZO. Most-used = Stability Pool at 12M / 25M = 48%.
    const total = result.current.mix.reduce((acc, m) => acc + m.percent, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
    expect(result.current.mostUsedStrategyId).toBe("stability-max");
    const stab = result.current.mix.find((m) => m.strategyId === "stability-max")!;
    expect(stab.percent).toBeGreaterThan(45);
    expect(stab.percent).toBeLessThan(52);
  });

  it("Given protocol total below the 0.01-veMEZO noise floor, When the hook resolves, Then it returns an empty mix", async () => {
    // 0.001 veMEZO total — well below the cutoff.
    const A = "0xaaa0000000000000000000000000000000000001";
    wagmiState.list = { data: [{ result: [A] }], isLoading: false, error: null };
    wagmiState.meta = {
      data: [
        { result: ["Stability Pool", 10n ** 15n] }, // 0.001 veMEZO
        { result: 0n },
      ],
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useProtocolStrategyMix(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mix).toEqual([]);
    expect(result.current.mostUsedStrategyId).toBeNull();
  });

  it("Given unmapped gauges share protocol weight, When the hook resolves, Then attributed percentages sum below 100 — no renormalization", async () => {
    // Codex P1 regression: previously drift renormalization inflated
    // the top mapped strategy by the unmapped slice. Two unmapped
    // gauges hold half the protocol weight; mapped slices must sum
    // strictly below 100.
    const A = "0xaaa0000000000000000000000000000000000001";
    const B = "0xbbb0000000000000000000000000000000000002";
    const C = "0xccc0000000000000000000000000000000000003";
    const D = "0xddd0000000000000000000000000000000000004";
    wagmiState.list = { data: [{ result: [A, B, C, D] }], isLoading: false, error: null };
    wagmiState.meta = {
      data: [
        { result: ["Stability Pool", 10_000_000n * 10n ** 18n] },
        { result: 0n },
        { result: ["MUSD Savings Rate", 5_000_000n * 10n ** 18n] },
        { result: 0n },
        { result: ["Unknown Gauge", 10_000_000n * 10n ** 18n] },
        { result: 0n },
        { result: ["Mystery Pool", 5_000_000n * 10n ** 18n] },
        { result: 0n },
      ],
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useProtocolStrategyMix(), { wrapper });
    await waitFor(() => expect(result.current.mix.length).toBeGreaterThan(0));

    // Mapped strategies = 15M of 30M protocol total → sum ≈ 50%, never close to 100.
    const sum = result.current.mix.reduce((acc, m) => acc + m.percent, 0);
    expect(sum).toBeGreaterThan(45);
    expect(sum).toBeLessThan(55);
  });

  it("Given an RPC error on the gauge list, When the hook resolves, Then isError surfaces the message", async () => {
    wagmiState.list = {
      data: undefined,
      isLoading: false,
      error: new Error("rpc gauge-list failure"),
    };
    const { result } = renderHook(() => useProtocolStrategyMix(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("rpc gauge-list failure");
  });
});
