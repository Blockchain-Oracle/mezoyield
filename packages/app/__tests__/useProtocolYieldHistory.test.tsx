import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Protocol-aggregate version of useYieldHistory. Differs from the
 * per-user hook in two ways:
 *
 *   - `RewardsClaimed` events are fetched WITHOUT the `user` arg filter
 *     so we get every claim across every account on the optimizer.
 *   - The hook does NOT depend on `useAccount()` — it runs even when
 *     no wallet is connected (the landing page is public).
 *
 * The padContiguousEpochs / anchor logic is shared (imported from
 * useYieldHistory) so it doesn't need to be re-tested here. We focus on
 * the protocol-aggregate-specific behavior.
 */

const SECONDS_PER_EPOCH = 604_800n;

const getLogsMock = vi.fn();
const getBlockMock = vi.fn();
import { OPTIMIZER_DEPLOYMENT_BLOCK as DEPLOY_BLOCK } from "@/lib/contracts";
const getBlockNumberMock = vi.fn(async () => DEPLOY_BLOCK);

vi.mock("wagmi", () => ({
  // No useAccount call — the protocol hook MUST work pre-connect.
  usePublicClient: () => ({
    getLogs: getLogsMock,
    getBlock: getBlockMock,
    getBlockNumber: getBlockNumberMock,
  }),
}));

// Subgraph short-circuit. By default unset (null) so the hook walks the
// RPC fallback path; one test overrides it.
const subgraphState: { value: { data: unknown; error: Error | null } } = {
  value: { data: null, error: null },
};
vi.mock("@/lib/subgraph", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subgraph")>(
    "@/lib/subgraph",
  );
  return {
    ...actual,
    fetchProtocolYieldHistoryFromSubgraph: vi.fn(async () => {
      if (subgraphState.value.error) throw subgraphState.value.error;
      return subgraphState.value.data as never;
    }),
  };
});

import { useProtocolYieldHistory } from "@/hooks/useProtocolYieldHistory";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const NOW_EPOCH = 100;

describe("useProtocolYieldHistory", () => {
  beforeEach(() => {
    getLogsMock.mockReset();
    getBlockMock.mockReset();
    subgraphState.value = { data: null, error: null };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(
      new Date(Number(NOW_EPOCH) * Number(SECONDS_PER_EPOCH) * 1000),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Given no claims on chain, When the hook resolves, Then it returns empty epochs + zero strategy mix", async () => {
    getLogsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useProtocolYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.epochs).toEqual([]);
    expect(result.current.totalVeMezoWei).toBe(0n);
    expect(result.current.strategyMix).toEqual([]);
  });

  it("Given claims from multiple users, When the hook resolves, Then totals are aggregated across all accounts", async () => {
    // Two users, each with one claim in the current epoch.
    const USER_A = "0x" + "a".repeat(40);
    const USER_B = "0x" + "b".repeat(40);
    const ts = BigInt(NOW_EPOCH) * SECONDS_PER_EPOCH + 100n;
    const logs = [
      { blockNumber: 200n, args: { user: USER_A, amount: 5n * 10n ** 18n } },
      { blockNumber: 201n, args: { user: USER_B, amount: 7n * 10n ** 18n } },
    ];
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: ts }),
    );

    const { result } = renderHook(() => useProtocolYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.epochs).toHaveLength(8);
    // Latest bucket = 12 MUSD (5 + 7).
    expect(result.current.epochs[7].musdWei).toBe(12n * 10n ** 18n);
    expect(result.current.epochs[7].epoch).toBe(NOW_EPOCH);
    // Two unique claimants.
    expect(result.current.uniqueClaimants).toBe(2);
  });

  it("Given several claims spread across epochs, When the hook resolves, Then epochs are contiguous (zero-filled)", async () => {
    const E5 = NOW_EPOCH - 5;
    const epochE5Start = BigInt(E5) * SECONDS_PER_EPOCH;
    const logs = [
      { blockNumber: 100n, args: { user: "0x" + "c".repeat(40), amount: 5n * 10n ** 18n } },
      { blockNumber: 101n, args: { user: "0x" + "d".repeat(40), amount: 3n * 10n ** 18n } },
    ];
    const tsByBlock = new Map<bigint, bigint>([
      [100n, epochE5Start + 100n],
      [101n, BigInt(NOW_EPOCH) * SECONDS_PER_EPOCH + 200n],
    ]);
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: tsByBlock.get(blockNumber)! }),
    );

    const { result } = renderHook(() => useProtocolYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    // Epochs must be monotonically contiguous (the padContiguousEpochs invariant).
    for (let i = 1; i < result.current.epochs.length; i++) {
      expect(result.current.epochs[i].epoch).toBe(
        result.current.epochs[i - 1].epoch + 1,
      );
    }
  });

  it("Given a getLogs failure, When the hook resolves, Then isError surfaces the error message", async () => {
    getLogsMock.mockRejectedValue(new Error("rpc protocol error"));
    const { result } = renderHook(() => useProtocolYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("rpc protocol error");
  });

  it("Given a configured subgraph endpoint, When the hook resolves, Then it prefers subgraph over RPC", async () => {
    // Pre-built protocol-aggregate response from the subgraph.
    const ts = BigInt(NOW_EPOCH) * SECONDS_PER_EPOCH + 100n;
    subgraphState.value = {
      data: {
        epochs: [{ epoch: NOW_EPOCH, musdWei: 42n * 10n ** 18n }],
        uniqueClaimants: 9,
        anchorTimestamp: ts,
      },
      error: null,
    };

    const { result } = renderHook(() => useProtocolYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.source).toBe("subgraph");
    // The subgraph response is padded through padContiguousEpochs the same way.
    expect(result.current.epochs).toHaveLength(8);
    expect(result.current.epochs[7].musdWei).toBe(42n * 10n ** 18n);
    expect(result.current.uniqueClaimants).toBe(9);
    // getLogs MUST NOT have been called when the subgraph delivered.
    expect(getLogsMock).not.toHaveBeenCalled();
  });
});
