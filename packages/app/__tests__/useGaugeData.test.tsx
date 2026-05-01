import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

/**
 * Locks the subgraph-vs-RPC fallback semantics from story-005.
 *
 * Codex caught a P1 on the first push: a subgraph error short-circuited
 * the hook even when the RPC fallback succeeded. This test asserts the
 * fix — when subgraph throws, the hook still returns RPC data when
 * available, and only surfaces an error when BOTH paths fail.
 */

// Mocks for the wagmi hooks the data hook depends on. Each test sets
// the desired return values via `wagmiState`.
const wagmiState: {
  list: { data?: unknown; isLoading: boolean; error: Error | null; refetch: () => void };
  meta: { data?: unknown; isLoading: boolean; error: Error | null; refetch: () => void };
} = {
  list: { data: undefined, isLoading: false, error: null, refetch: vi.fn() },
  meta: { data: undefined, isLoading: false, error: null, refetch: vi.fn() },
};

vi.mock("wagmi", () => ({
  // Each call alternates between list / meta — the hook calls list FIRST,
  // then meta SECOND, in that order. We track call ordinality on `useReadContracts`
  // so the matching state is returned.
  useReadContracts: (() => {
    let n = 0;
    return () => {
      const i = n % 2;
      n += 1;
      return i === 0 ? wagmiState.list : wagmiState.meta;
    };
  })(),
}));

const subgraphState: { value: { data: unknown; error: Error | null; isLoading: boolean } } = {
  value: { data: null, error: null, isLoading: false },
};

vi.mock("@/lib/subgraph", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subgraph")>("@/lib/subgraph");
  return {
    ...actual,
    fetchGaugesFromSubgraph: vi.fn(async () => {
      if (subgraphState.value.error) throw subgraphState.value.error;
      return subgraphState.value.data as never;
    }),
  };
});

import { useGaugeData } from "@/hooks/useGaugeData";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const A1 = "0xaaa0000000000000000000000000000000000001" as const;
const A2 = "0xbbb0000000000000000000000000000000000002" as const;

describe("useGaugeData", () => {
  beforeEach(() => {
    wagmiState.list = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    wagmiState.meta = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    subgraphState.value = { data: null, error: null, isLoading: false };
  });

  it("returns RPC data when no subgraph endpoint is configured", async () => {
    subgraphState.value = { data: null, error: null, isLoading: false };
    wagmiState.list = { data: [{ result: [A1] }], isLoading: false, error: null, refetch: vi.fn() };
    wagmiState.meta = {
      data: [
        { result: ["Stability Pool", 12_500_000n * 10n ** 18n] },
        { result: 8_400n * 10n ** 18n },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };

    const { result } = renderHook(() => useGaugeData(), { wrapper });
    await waitFor(() => expect(result.current.source).toBe("rpc"));
    expect(result.current.gauges).toHaveLength(1);
    expect(result.current.gauges?.[0].name).toBe("Stability Pool");
    expect(result.current.isError).toBe(false);
  });

  it("falls back to RPC when the subgraph errors transiently (the Codex P1 fix)", async () => {
    subgraphState.value = {
      data: undefined,
      error: new Error("goldsky 503"),
      isLoading: false,
    };
    wagmiState.list = { data: [{ result: [A1, A2] }], isLoading: false, error: null, refetch: vi.fn() };
    wagmiState.meta = {
      data: [
        { result: ["Gauge A", 1_000_000n * 10n ** 18n] },
        { result: 100n * 10n ** 18n },
        { result: ["Gauge B", 2_000_000n * 10n ** 18n] },
        { result: 200n * 10n ** 18n },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };

    const { result } = renderHook(() => useGaugeData(), { wrapper });
    await waitFor(() => expect(result.current.gauges).toHaveLength(2));
    expect(result.current.source).toBe("rpc");
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns isError only when BOTH subgraph and RPC fail", async () => {
    subgraphState.value = {
      data: undefined,
      error: new Error("goldsky down"),
      isLoading: false,
    };
    wagmiState.list = {
      data: undefined,
      isLoading: false,
      error: new Error("rpc 502"),
      refetch: vi.fn(),
    };

    const { result } = renderHook(() => useGaugeData(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("rpc 502");
  });
});
