import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Locks the STORY-007 routing decision: BOTH "auto" and "manual" submit
 * modes must call `setManualAllocation` (caller-authorized). The
 * `castOptimalVote` path is `onlyKeeper` per
 * `MezoYieldOptimizer.castOptimalVote` and would revert for any
 * non-keeper wallet — i.e. every regular user.
 *
 * Codex P1 on PR #24 commit 909c009 specifically asked for this test
 * after the routing fix.
 */

type WriteArgs = {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly [readonly `0x${string}`[], readonly bigint[]];
};
const writeContractAsync = vi.fn(
  async (_args: WriteArgs): Promise<`0x${string}`> => "0xdead",
);

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync }),
  useWaitForTransactionReceipt: () => ({
    isSuccess: false,
    isError: false,
    error: null,
  }),
}));

import { useSubmitVote } from "@/hooks/useSubmitVote";

const G1: `0x${string}` = "0xa000000000000000000000000000000000000001";
const G2: `0x${string}` = "0xa000000000000000000000000000000000000002";

describe("useSubmitVote routing", () => {
  beforeEach(() => {
    writeContractAsync.mockClear();
  });

  it("auto mode calls setManualAllocation (NOT the keeper-only castOptimalVote)", async () => {
    const { result } = renderHook(() => useSubmitVote());
    await act(async () => {
      await result.current.submit("auto", [
        { gauge: G1, weightBps: 6_000 },
        { gauge: G2, weightBps: 4_000 },
      ]);
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const callArgs = writeContractAsync.mock.calls[0]![0];
    expect(callArgs.functionName).toBe("setManualAllocation");
    expect(callArgs.functionName).not.toBe("castOptimalVote");
  });

  it("manual mode also calls setManualAllocation", async () => {
    const { result } = renderHook(() => useSubmitVote());
    await act(async () => {
      await result.current.submit("manual", [
        { gauge: G1, weightBps: 10_000 },
      ]);
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const callArgs = writeContractAsync.mock.calls[0]![0];
    expect(callArgs.functionName).toBe("setManualAllocation");
  });

  it("forwards the BPS weights as bigints in the on-chain call", async () => {
    const { result } = renderHook(() => useSubmitVote());
    await act(async () => {
      await result.current.submit("auto", [
        { gauge: G1, weightBps: 6_000 },
        { gauge: G2, weightBps: 4_000 },
      ]);
    });
    const callArgs = writeContractAsync.mock.calls[0]![0];
    expect(callArgs.args[0]).toEqual([G1, G2]);
    expect(callArgs.args[1]).toEqual([6_000n, 4_000n]);
  });

  it("captures the tx hash and moves to confirming phase on success", async () => {
    const { result } = renderHook(() => useSubmitVote());
    await act(async () => {
      await result.current.submit("auto", [{ gauge: G1, weightBps: 10_000 }]);
    });
    await waitFor(() => expect(result.current.txHash).toBe("0xdead"));
    expect(result.current.status).toBe("confirming");
  });

  it("surfaces the revert reason from a viem BaseError on submit failure", async () => {
    writeContractAsync.mockRejectedValueOnce({
      shortMessage: "user rejected request",
      message: "long form",
    });
    const { result } = renderHook(() => useSubmitVote());
    await act(async () => {
      await result.current.submit("auto", [{ gauge: G1, weightBps: 10_000 }]);
    });
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("user rejected request");
  });
});
