import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

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

describe("useClaimRewards: wallet switch reset", () => {
  beforeEach(() => {
    writeContractAsync.mockClear();
    refetch.mockClear();
    receiptState.isSuccess = false;
    receiptState.isError = false;
    receiptState.error = null;
  });

  it("resets phase + txHash when the connected user changes mid-flight", async () => {
    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A } },
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

  it("does NOT reset when user stays the same across rerenders", async () => {
    const { result, rerender } = renderHook(
      ({ user }: { user: `0x${string}` }) => useClaimRewards(user),
      { initialProps: { user: A } },
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
