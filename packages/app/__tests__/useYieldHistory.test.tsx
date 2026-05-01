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

  it("groups claims by Unix epoch (604800s) and returns last 8 buckets", async () => {
    // Two claims in epoch E0, one in E1, one in E5. Expect 3 buckets,
    // sorted ascending by epoch — chart x-axis renders left-to-right
    // from oldest to newest. (CLAUDE.md UX spec: Epoch -7…0 relative.)
    const epoch0Start = 1_700_000n * SECONDS_PER_EPOCH;
    const e1 = epoch0Start + SECONDS_PER_EPOCH * 1n + 1000n;
    const e5 = epoch0Start + SECONDS_PER_EPOCH * 5n + 200n;
    const a1 = logAt(epoch0Start + 100n, 5n * 10n ** 18n);
    const a2 = logAt(epoch0Start + 500n, 3n * 10n ** 18n);
    const b1 = logAt(e1, 7n * 10n ** 18n);
    const c1 = logAt(e5, 2n * 10n ** 18n, 200n);

    getLogsMock.mockResolvedValue([a1.log, a2.log, b1.log, c1.log]);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) => {
      if (blockNumber === 100n) return Promise.resolve(a1.block);
      if (blockNumber === 200n) return Promise.resolve(c1.block);
      // a2 + b1 both share the default block 100n in this fixture; for
      // realism we mint distinct blocks per log. Map by reference here.
      return Promise.resolve({ number: blockNumber, timestamp: 0n });
    });

    // To make the per-log timestamp unambiguous, use a unique block per log:
    const logs = [a1, a2, b1, c1].map((x, i) => ({
      ...x.log,
      blockNumber: BigInt(100 + i),
    }));
    const tsByBlock = new Map<bigint, bigint>([
      [100n, a1.block.timestamp],
      [101n, a2.block.timestamp],
      [102n, b1.block.timestamp],
      [103n, c1.block.timestamp],
    ]);
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: tsByBlock.get(blockNumber)! }),
    );

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    // 3 distinct epochs after grouping — and they fit within the 8-cap.
    expect(result.current.epochs).toHaveLength(3);
    // Sort: ascending by epoch index → E0, E1, E5.
    expect(result.current.epochs[0].musdWei).toBe(8n * 10n ** 18n); // 5 + 3
    expect(result.current.epochs[1].musdWei).toBe(7n * 10n ** 18n);
    expect(result.current.epochs[2].musdWei).toBe(2n * 10n ** 18n);
    // Epoch indices monotonically increase.
    expect(result.current.epochs[1].epoch).toBeGreaterThan(
      result.current.epochs[0].epoch,
    );
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
