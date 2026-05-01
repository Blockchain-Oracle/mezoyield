import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// Pin "now" deterministically. Without this, tests that exercise the
// anchor logic depend on real wall-clock and break when fixture epochs
// drift from the actual current epoch.
const NOW_EPOCH = 100;

describe("useYieldHistory", () => {
  beforeEach(() => {
    getLogsMock.mockReset();
    getBlockMock.mockReset();
    accountState.value = { address: USER };
    // shouldAdvanceTime: true lets RTL's waitFor poll-loop run while
    // Date.now stays pinned to NOW_EPOCH. Without this, fake timers
    // freeze waitFor's polling and every async test times out.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(
      new Date(Number(NOW_EPOCH) * Number(SECONDS_PER_EPOCH) * 1000),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty epochs when wallet is disconnected", () => {
    accountState.value = {};
    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    expect(result.current.epochs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(getLogsMock).not.toHaveBeenCalled();
  });

  it("groups claims by Unix epoch and emits 8 contiguous buckets with zero-fill (Codex P1 round 1)", async () => {
    // Two claims in epoch (now-5), one in (now-4), one in now. Anchor
    // = now (latestClaim is inside the window). Contiguous epochs
    // [now-7..now], 8 slots:
    //   n-7:0  n-6:0  n-5:8  n-4:7  n-3:0  n-2:0  n-1:0  n:2
    const E5 = NOW_EPOCH - 5;
    const E4 = NOW_EPOCH - 4;
    const epochE5Start = BigInt(E5) * SECONDS_PER_EPOCH;
    const logs = [
      { blockNumber: 100n, args: { user: USER, amount: 5n * 10n ** 18n } }, // E5
      { blockNumber: 101n, args: { user: USER, amount: 3n * 10n ** 18n } }, // also E5
      { blockNumber: 102n, args: { user: USER, amount: 7n * 10n ** 18n } }, // E4
      { blockNumber: 103n, args: { user: USER, amount: 2n * 10n ** 18n } }, // now
    ];
    const tsByBlock = new Map<bigint, bigint>([
      [100n, epochE5Start + 100n],
      [101n, epochE5Start + 500n],
      [102n, epochE5Start + SECONDS_PER_EPOCH * 1n + 1000n],
      [103n, BigInt(NOW_EPOCH) * SECONDS_PER_EPOCH + 200n],
    ]);
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: tsByBlock.get(blockNumber)! }),
    );

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.epochs).toHaveLength(8);
    expect(result.current.epochs[7].epoch).toBe(NOW_EPOCH);
    expect(result.current.epochs[0].epoch).toBe(NOW_EPOCH - 7);
    const wei = result.current.epochs.map((b) => b.musdWei);
    expect(wei).toEqual([
      0n,                  // now-7
      0n,                  // now-6
      8n * 10n ** 18n,     // now-5 (5+3)
      7n * 10n ** 18n,     // now-4
      0n,                  // now-3
      0n,                  // now-2
      0n,                  // now-1
      2n * 10n ** 18n,     // now
    ]);
    void E4; // referenced via tsByBlock; kept for readability above.
    // Epoch indices monotonically increase by exactly 1 — contiguous.
    for (let i = 1; i < result.current.epochs.length; i++) {
      expect(result.current.epochs[i].epoch).toBe(
        result.current.epochs[i - 1].epoch + 1,
      );
    }
  });

  it("anchors on latestClaim when the user is dormant (Codex P1 round 2)", async () => {
    // Dormant user: last claim was 20 epochs ago. The naive
    // `Math.max(now, latestClaim)` rule would pick `now` and produce
    // 8 zero-bars, hiding the user's real history. The correct rule:
    // when latestClaim < now-7, anchor on latestClaim so 8 weeks
    // ENDING at the last activity are visible.
    //
    // Simulate "now" = epoch 100. Last claim = epoch 80 (20 weeks ago).
    // Expected anchor = 80, contiguous range [73..80], with the claim
    // landing in slot index 7.
    const LAST_CLAIM_EPOCH = NOW_EPOCH - 20;
    const ts = BigInt(LAST_CLAIM_EPOCH) * SECONDS_PER_EPOCH + 100n;
    getLogsMock.mockResolvedValue([
      { blockNumber: 200n, args: { user: USER, amount: 11n * 10n ** 18n } },
    ]);
    getBlockMock.mockResolvedValue({ number: 200n, timestamp: ts });

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    // Anchor must be the latest claim (80), NOT now (100).
    expect(result.current.epochs[7].epoch).toBe(LAST_CLAIM_EPOCH);
    expect(result.current.epochs[0].epoch).toBe(LAST_CLAIM_EPOCH - 7);
    expect(result.current.epochs[7].musdWei).toBe(11n * 10n ** 18n);
    // The other 7 are zero-fill.
    for (let i = 0; i < 7; i++) {
      expect(result.current.epochs[i].musdWei).toBe(0n);
    }
  });

  it("anchors on latestClaim when the latest claim is in the future relative to local clock (Codex P1 round 3)", async () => {
    // Clock-skew edge case: chain timestamp lands in epoch (now + 1)
    // because the indexer / RPC node's clock is slightly ahead of ours.
    // The naive `latestClaim >= now-7` check (round 2) passed because
    // (now+1) > (now-7), so we anchored on `now` and the future claim
    // fell outside the rendered [now-7..now] window — chart of zeros.
    // The fixed rule requires latestClaim to be in BOTH bounds
    // [now-7, now]; future claims fall through to anchor=latestClaim.
    const FUTURE_CLAIM_EPOCH = NOW_EPOCH + 1;
    const ts = BigInt(FUTURE_CLAIM_EPOCH) * SECONDS_PER_EPOCH + 100n;
    getLogsMock.mockResolvedValue([
      { blockNumber: 200n, args: { user: USER, amount: 9n * 10n ** 18n } },
    ]);
    getBlockMock.mockResolvedValue({ number: 200n, timestamp: ts });

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    expect(result.current.epochs[7].epoch).toBe(FUTURE_CLAIM_EPOCH);
    expect(result.current.epochs[7].musdWei).toBe(9n * 10n ** 18n);
  });

  it("anchors on now when the latest claim is inside the trailing 8-epoch window", async () => {
    // Active user: claimed in current epoch. Anchor must be `now` so
    // "Epoch 0" is right-now and the claim lands in slot 7.
    const ts = BigInt(NOW_EPOCH) * SECONDS_PER_EPOCH + 50n;
    getLogsMock.mockResolvedValue([
      { blockNumber: 200n, args: { user: USER, amount: 6n * 10n ** 18n } },
    ]);
    getBlockMock.mockResolvedValue({ number: 200n, timestamp: ts });

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs[7].epoch).toBe(NOW_EPOCH);
    expect(result.current.epochs[7].musdWei).toBe(6n * 10n ** 18n);
  });

  it("zero-fills weeks with no claims even when only one week inside the window has activity", async () => {
    // Single claim in current epoch. The chart should still show 8
    // contiguous calendar slots — 7 zeros + the one bar. This is the
    // case Codex explicitly called out on round 1: "weeks 1 and 8 only"
    // → 2 bars labeled "Epoch -1, 0" hides the 6-week gap.
    const ts = BigInt(NOW_EPOCH) * SECONDS_PER_EPOCH + 100n;
    getLogsMock.mockResolvedValue([
      { blockNumber: 200n, args: { user: USER, amount: 4n * 10n ** 18n } },
    ]);
    getBlockMock.mockResolvedValue({ number: 200n, timestamp: ts });

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    expect(result.current.epochs[7].epoch).toBe(NOW_EPOCH);
    expect(result.current.epochs[7].musdWei).toBe(4n * 10n ** 18n);
    for (let i = 0; i < 7; i++) {
      expect(result.current.epochs[i].musdWei).toBe(0n);
    }
  });

  it("caps at 8 most recent buckets when history is longer", async () => {
    // 12 distinct claim epochs ending at `now`. Anchor = now (latest is
    // inside window). Contiguous [now-7..now]. The 4 oldest claims
    // (i=0..3, epochs now-11..now-8) fall outside the window and are
    // dropped; the 8 newest (i=4..11, epochs now-7..now) appear in
    // sequence with their respective amounts.
    const startEpoch = NOW_EPOCH - 11;
    const startTs = BigInt(startEpoch) * SECONDS_PER_EPOCH;
    const logs = Array.from({ length: 12 }, (_, i) => ({
      blockNumber: BigInt(100 + i),
      transactionHash: ("0x" + "a".repeat(64)) as `0x${string}`,
      args: { user: USER, amount: BigInt(i + 1) * 10n ** 18n },
    }));
    const tsByBlock = new Map<bigint, bigint>(
      logs.map((l, i) => [l.blockNumber, startTs + SECONDS_PER_EPOCH * BigInt(i)]),
    );
    getLogsMock.mockResolvedValue(logs);
    getBlockMock.mockImplementation(({ blockNumber }: { blockNumber: bigint }) =>
      Promise.resolve({ number: blockNumber, timestamp: tsByBlock.get(blockNumber)! }),
    );

    const { result } = renderHook(() => useYieldHistory(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.epochs).toHaveLength(8);
    // First slot is anchor-7 = now-7, which corresponds to i=4 → 5 MUSD.
    expect(result.current.epochs[0].musdWei).toBe(5n * 10n ** 18n);
    expect(result.current.epochs[0].epoch).toBe(NOW_EPOCH - 7);
    // Last slot is anchor = now, corresponding to i=11 → 12 MUSD.
    expect(result.current.epochs[7].musdWei).toBe(12n * 10n ** 18n);
    expect(result.current.epochs[7].epoch).toBe(NOW_EPOCH);
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
