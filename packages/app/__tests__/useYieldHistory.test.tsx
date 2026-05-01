import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * STORY-009 BDD coverage for useYieldHistory:
 *   - Connected user with claim history → bucketed-by-epoch + last 8 entries
 *   - Disconnected user → returns empty + isLoading false
 *   - getLogs error → isError true, surfaces error message
 *   - Multiple claims in same epoch → summed into one bucket
 *
 * Strategy: viem's PublicClient is the data source (getLogs +
 * getBlock). Mock it via wagmi's `usePublicClient` hook. The epoch
 * partition uses Unix-time floor division by 604_800.
 */

const SECONDS_PER_EPOCH = 604_800n;

const getLogsMock = vi.fn();
const getBlockMock = vi.fn();
const accountState: { value: { address?: `0x${string}` } } = { value: {} };

vi.mock("wagmi", () => ({
  useAccount: () => accountState.value,
  usePublicClient: () => ({
    getLogs: getLogsMock,
    getBlock: getBlockMock,
  }),
}));

import { useYieldHistory } from "@/hooks/useYieldHistory";

const wrapper = ({ children }: { children: ReactNode }) => {
  // Fresh client per test so caches don't leak between cases.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const USER: `0x${string}` = "0xa0000000000000000000000000000000000000aa";

// Build a fake RewardsClaimed log + the matching block timestamp.
function logAt(blockTimestamp: bigint, amountWei: bigint, blockNumber = 100n) {
  return {
    log: {
      blockNumber,
      transactionHash: ("0x" + "a".repeat(64)) as `0x${string}`,
      args: { user: USER, amount: amountWei },
    },
    block: { number: blockNumber, timestamp: blockTimestamp },
  };
}

describe("useYieldHistory", () => {
  beforeEach(() => {
    getLogsMock.mockReset();
    getBlockMock.mockReset();
    accountState.value = { address: USER };
  });

  it("returns empty epochs when wallet is disconnected", () => {
    accountState.value = {};
    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    expect(result.current.epochs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(getLogsMock).not.toHaveBeenCalled();
  });

  it("groups claims by Unix epoch and emits 8 contiguous buckets with zero-fill (Codex P1 round 1)", async () => {
    // Two claims in epoch E0, one in E1, one in E5. The X-axis is a
    // CALENDAR — gaps must show as zero-bars, not be omitted (Codex P1
    // on PR #27). With anchor = max(latestClaim=E5, nowEpoch) = E5,
    // we expect contiguous epochs [E-2..E5] (8 slots), filled as:
    //   E-2:0  E-1:0  E0:8  E1:7  E2:0  E3:0  E4:0  E5:2
    const E0 = 1_700_000;
    const epoch0Start = BigInt(E0) * SECONDS_PER_EPOCH;
    const logs = [
      { blockNumber: 100n, args: { user: USER, amount: 5n * 10n ** 18n } },
      { blockNumber: 101n, args: { user: USER, amount: 3n * 10n ** 18n } }, // also E0
      { blockNumber: 102n, args: { user: USER, amount: 7n * 10n ** 18n } }, // E1
      { blockNumber: 103n, args: { user: USER, amount: 2n * 10n ** 18n } }, // E5
    ];
    const tsByBlock = new Map<bigint, bigint>([
      [100n, epoch0Start + 100n],
      [101n, epoch0Start + 500n],
      [102n, epoch0Start + SECONDS_PER_EPOCH * 1n + 1000n],
      [103n, epoch0Start + SECONDS_PER_EPOCH * 5n + 200n],
    ]);
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: tsByBlock.get(blockNumber)! }),
    );

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    // Exactly 8 contiguous epoch slots, ending at the latest claim.
    expect(result.current.epochs).toHaveLength(8);
    const last = result.current.epochs[7];
    expect(last.epoch).toBe(E0 + 5);
    // First slot is anchor - 7.
    expect(result.current.epochs[0].epoch).toBe(E0 - 2);
    // Sums in the right slots.
    const wei = result.current.epochs.map((b) => b.musdWei);
    expect(wei).toEqual([
      0n,                  // E-2
      0n,                  // E-1
      8n * 10n ** 18n,     // E0 (5+3)
      7n * 10n ** 18n,     // E1
      0n,                  // E2
      0n,                  // E3
      0n,                  // E4
      2n * 10n ** 18n,     // E5
    ]);
    // Epoch indices monotonically increase by exactly 1 — contiguous.
    for (let i = 1; i < result.current.epochs.length; i++) {
      expect(result.current.epochs[i].epoch).toBe(
        result.current.epochs[i - 1].epoch + 1,
      );
    }
  });

  it("zero-fills weeks with no claims even when only the most recent week has activity", async () => {
    // Single claim, far back. The chart should still show 8 contiguous
    // calendar slots — 7 zeros + the one bar. This is the case Codex
    // explicitly called out: "weeks 1 and 8 only" → 2 bars labeled
    // "Epoch -1, 0" hides the gap.
    const E = 1_700_050;
    const ts = BigInt(E) * SECONDS_PER_EPOCH + 100n;
    getLogsMock.mockResolvedValue([
      { blockNumber: 200n, args: { user: USER, amount: 4n * 10n ** 18n } },
    ]);
    getBlockMock.mockResolvedValue({ number: 200n, timestamp: ts });

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    expect(result.current.epochs[7].epoch).toBe(E);
    expect(result.current.epochs[7].musdWei).toBe(4n * 10n ** 18n);
    for (let i = 0; i < 7; i++) {
      expect(result.current.epochs[i].musdWei).toBe(0n);
    }
  });

  it("caps at 8 most recent buckets when history is longer", async () => {
    const epoch0Start = 1_700_000n * SECONDS_PER_EPOCH;
    // 12 distinct epochs, each with one claim. Hook should return the
    // newest 8. The X-axis caption per spec is "last 8 epochs".
    const logs = Array.from({ length: 12 }, (_, i) => ({
      blockNumber: BigInt(100 + i),
      transactionHash: ("0x" + "a".repeat(64)) as `0x${string}`,
      args: { user: USER, amount: BigInt(i + 1) * 10n ** 18n },
    }));
    const tsByBlock = new Map<bigint, bigint>(
      logs.map((l, i) => [l.blockNumber, epoch0Start + SECONDS_PER_EPOCH * BigInt(i)]),
    );
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: tsByBlock.get(blockNumber)! }),
    );

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    // First entry should be the OLDEST of the trailing 8 — i.e., epoch
    // index 4 (0-3 dropped). Amount at i=4 was 5 MUSD.
    expect(result.current.epochs[0].musdWei).toBe(5n * 10n ** 18n);
    expect(result.current.epochs[7].musdWei).toBe(12n * 10n ** 18n);
  });

  it("returns empty epochs (not error) when getLogs returns []", async () => {
    getLogsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.epochs).toEqual([]);
    // No timestamp lookups when there are no logs — saves an RPC roundtrip.
    expect(getBlockMock).not.toHaveBeenCalled();
  });

  it("surfaces RPC errors via isError + error message", async () => {
    getLogsMock.mockRejectedValue(new Error("rpc unavailable"));
    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("rpc unavailable");
  });
});
