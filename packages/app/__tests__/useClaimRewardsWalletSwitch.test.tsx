import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Codex P2 on PR #25 (commit 3a8f...): in-flight claim state persisted
 * across wallet switches. If wallet A submits a claim and the user
 * switches to wallet B before the receipt lands, B inherited A's UI
 * state and the success-path refetch ran against B's pending query
 * instead of A's just-claimed balance.
 *
 * Fix: track `claimUser` and reset all phase/tx/error state when the
 * connected `user` differs from the one that initiated the claim.
 */

const writeContractAsync = vi.fn(async (_args: unknown): Promise<`0x${string}`> => "0xdeadbeef");
const readContractData: { value?: bigint } = { value: 25n * 10n ** 18n };
const refetch = vi.fn();
const receiptState: { isSuccess: boolean; isError: boolean; error: Error | null } = {
  isSuccess: false,
  isError: false,
  error: null,
};

vi.mock("wagmi", () => ({
  useReadContract: () => ({
    data: readContractData.value,
    isLoading: false,
    refetch,
  }),
  useWriteContract: () => ({ writeContractAsync }),
  useWaitForTransactionReceipt: () => receiptState,
}));

import { useClaimRewards } from "@/hooks/useClaimRewards";

const A: `0x${string}` = "0xa0000000000000000000000000000000000000aa";
const B: `0x${string}` = "0xb0000000000000000000000000000000000000bb";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useClaimRewards: wallet switch reset", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    writeContractAsync.mockClear();
    refetch.mockClear();
    receiptState.isSuccess = false;
    receiptState.isError = false;
    receiptState.error = null;
  });

  it("resets phase + txHash when the connected user changes mid-flight", async () => {
    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A }, wrapper },
    );
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.status).toBe("confirming");
    expect(result.current.txHash).toBe("0xdeadbeef");

    // User switches to wallet B before receipt lands.
    rerender({ user: B });
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.errorMessage).toBeUndefined();
  });

  it("drops a late writeContractAsync resolution when wallet switches mid-write", async () => {
    // Codex P2 round 2 (commit 5a98368): writeContractAsync is itself an
    // await point. If the user switches wallets while the write is pending
    // — *before* the hash returns — the resolved promise would still set
    // txHash and phase="confirming" for the abandoned wallet after the
    // reset effect ran. The ref-guard inside `claim` must drop the result.
    let resolveWrite: (h: `0x${string}`) => void = () => {};
    writeContractAsync.mockImplementationOnce(
      () => new Promise<`0x${string}`>((res) => { resolveWrite = res; }),
    );

    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A }, wrapper },
    );

    // Kick off claim — promise is pending, no hash yet.
    let claimPromise: Promise<void>;
    act(() => {
      claimPromise = result.current.claim();
    });
    expect(result.current.status).toBe("writing");

    // User switches to B while write is still pending.
    rerender({ user: B });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    // Now the write resolves — the late completion must NOT pollute B's state.
    await act(async () => {
      resolveWrite("0xlatehash");
      await claimPromise;
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.txHash).toBeUndefined();
  });

  it("token guard: A's late resolution doesn't pollute B's freshly-started claim", async () => {
    // Codex P2 round 3 (commit d0d3d01): a single shared abandoned flag is
    // not enough. If A starts a claim (flag=false), wallet switches to B
    // (flag=true via reset effect), then B starts a claim (which sets
    // flag=false again at the start), A's still-pending writeContractAsync
    // would now pass the `if (abandoned) return` check because B's claim
    // re-opened the gate. Result: A's stale hash overwrites B's txHash and
    // phase. Per-claim monotonic token fixes it: B's myToken !== A's myToken,
    // and only the latest token wins.
    let resolveA: (h: `0x${string}`) => void = () => {};
    let resolveB: (h: `0x${string}`) => void = () => {};
    writeContractAsync
      .mockImplementationOnce(
        () => new Promise<`0x${string}`>((res) => { resolveA = res; }),
      )
      .mockImplementationOnce(
        () => new Promise<`0x${string}`>((res) => { resolveB = res; }),
      );

    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A }, wrapper },
    );

    // A starts claim → pending.
    let claimA: Promise<void>;
    act(() => { claimA = result.current.claim(); });
    expect(result.current.status).toBe("writing");

    // Switch to B; reset effect bumps token.
    rerender({ user: B });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    // B starts a fresh claim → pending. Token bumps again. claimB owns the
    // latest token; A's myToken is now two generations stale.
    let claimB: Promise<void>;
    act(() => { claimB = result.current.claim(); });
    expect(result.current.status).toBe("writing");

    // A's late resolution arrives — must NOT touch state because A's token
    // is no longer current.
    await act(async () => {
      resolveA("0xstaleA");
      await claimA;
    });
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.status).toBe("writing"); // still B's "writing"

    // B's resolution then lands — must go through.
    await act(async () => {
      resolveB("0xliveB");
      await claimB;
    });
    expect(result.current.txHash).toBe("0xliveB");
    expect(result.current.status).toBe("confirming");
  });

  it("invalidates the user-scoped yield-history query on confirmed claim (Codex pre-push P2 STORY-009)", async () => {
    // STORY-009 BDD: \"user claims rewards in current epoch → YieldChart
    // updates\". Without invalidation, useYieldHistory's 30s staleTime
    // leaves the chart on pre-claim buckets until remount/refocus.
    // Spy on the queryClient's invalidateQueries to confirm we issue the
    // correct key once receipt.isSuccess flips.
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A }, wrapper },
    );
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.status).toBe("confirming");

    // Receipt confirms — flip the receipt mock and rerender to trigger
    // the success-path useEffect.
    receiptState.isSuccess = true;
    rerender({ user: A });
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["yield-history", A],
    });
  });

  it("does NOT reset when user stays the same across rerenders", async () => {
    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A }, wrapper },
    );
    await act(async () => {
      await result.current.claim();
    });
    expect(result.current.status).toBe("confirming");
    rerender({ user: A });
    expect(result.current.status).toBe("confirming");
    expect(result.current.txHash).toBe("0xdeadbeef");
  });
});
