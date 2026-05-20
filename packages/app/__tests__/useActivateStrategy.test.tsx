import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Mock harness for `useActivateStrategy` covering the chained-precondition
 * flow added by #32/#33/#39. The hook reads two contracts (isDelegated,
 * balanceOf), submits up to three writes (faucet, delegate, vote), and
 * awaits each receipt via `publicClient.waitForTransactionReceipt` between
 * steps. The mocks below let each test set the "world" state and assert
 * which writes fired in which order.
 */

const writeContractAsync = vi.fn(
  async (_args: unknown): Promise<`0x${string}`> =>
    `0x${Math.random().toString(16).slice(2, 10).padEnd(64, "0")}` as `0x${string}`,
);
const isDelegatedState: { value?: boolean } = { value: false };
const veMezoBalanceState: { value: bigint } = { value: 0n };
const refetchDelegated = vi.fn();
const refetchVeMezoBalance = vi.fn();
const waitForReceipt = vi.fn(async () => ({ status: "success" as const }));
const receiptState: {
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
} = {
  isSuccess: false,
  isError: false,
  error: null,
};

vi.mock("wagmi", () => ({
  useReadContract: ({
    functionName,
  }: {
    functionName?: string;
  } = {}) => {
    // The hook reads two contracts. Discriminate by functionName so each
    // returns the matching test-state value.
    if (functionName === "balanceOf") {
      return {
        data: veMezoBalanceState.value,
        isLoading: false,
        refetch: refetchVeMezoBalance,
      };
    }
    // isDelegated (default)
    return {
      data: isDelegatedState.value,
      isLoading: false,
      refetch: refetchDelegated,
    };
  },
  useWriteContract: () => ({ writeContractAsync }),
  useWaitForTransactionReceipt: () => receiptState,
  usePublicClient: () => ({ waitForTransactionReceipt: waitForReceipt }),
}));

import { useActivateStrategy } from "@/features/strategies/useActivateStrategy";
import { STRATEGY_PRESETS } from "@/features/strategies/presets";
import type { Address, Gauge } from "@/lib/types";
import { TOTAL_BPS } from "@/lib/optimize";

const USER: Address = "0xa0000000000000000000000000000000000000aa";

const G_STAB: Gauge = {
  address: "0x0000000000000000000000000000000000000001" as Address,
  name: "Stability Pool",
  totalVeMezoWei: 12_500_000n * 10n ** 18n,
  bribeMUSDWei: 8_400n * 10n ** 18n,
  apyPercent: 3.5,
};
const G_MUSD: Gauge = {
  address: "0x0000000000000000000000000000000000000002" as Address,
  name: "MUSD Savings Rate",
  totalVeMezoWei: 9_200_000n * 10n ** 18n,
  bribeMUSDWei: 4_500n * 10n ** 18n,
  apyPercent: 2.5,
};
const G_BTC: Gauge = {
  address: "0x0000000000000000000000000000000000000003" as Address,
  name: "BTC-MUSD LP",
  totalVeMezoWei: 6_700_000n * 10n ** 18n,
  bribeMUSDWei: 5_200n * 10n ** 18n,
  apyPercent: 4.0,
};
const ALL_GAUGES = [G_STAB, G_MUSD, G_BTC];

const SET_AND_FORGET = STRATEGY_PRESETS.find((p) => p.id === "set-and-forget")!;
const STAB_MAX = STRATEGY_PRESETS.find((p) => p.id === "stability-max")!;
const BALANCED = STRATEGY_PRESETS.find((p) => p.id === "balanced")!;
const CUSTOM = STRATEGY_PRESETS.find((p) => p.id === "custom")!;

/**
 * Default world: connected wallet ALREADY has 1000 veMEZO and IS already
 * delegated. This is the "everything pre-met" state used by tests that
 * only care about the final strategy-specific tx. Branch tests override
 * the relevant flags in their setup.
 */
function setPreconditionsMet() {
  isDelegatedState.value = true;
  veMezoBalanceState.value = 1_000n * 10n ** 18n;
}

describe("useActivateStrategy", () => {
  beforeEach(() => {
    writeContractAsync.mockClear();
    refetchDelegated.mockClear();
    refetchVeMezoBalance.mockClear();
    waitForReceipt.mockClear();
    isDelegatedState.value = false;
    veMezoBalanceState.value = 0n;
    receiptState.isSuccess = false;
    receiptState.isError = false;
    receiptState.error = null;
  });

  // ─── Set & Forget mode ───────────────────────────────────────────

  it("Set & Forget with preconditions met: short-circuits to success, no tx", async () => {
    // #32: already-delegated wallet should not pop a redundant prompt.
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: SET_AND_FORGET, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("success");
  });

  it("Set & Forget on fresh testnet wallet: faucet → delegate → success (2 txs)", async () => {
    // #33 + #39: zero veMEZO + not-delegated → chained txs.
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: SET_AND_FORGET, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["faucet", "delegate"]);
    expect(waitForReceipt).toHaveBeenCalledTimes(2); // one per intermediate write
    expect(result.current.status).toBe("success");
  });

  it("Set & Forget with veMEZO but not delegated: delegate only (1 tx)", async () => {
    // #39: faucet skipped (balance > 0), delegate fires.
    veMezoBalanceState.value = 500n * 10n ** 18n;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: SET_AND_FORGET, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["delegate"]);
    expect(result.current.status).toBe("success");
  });

  // ─── Manual mode ─────────────────────────────────────────────────

  it("Stability Max with preconditions met: setManualAllocation only (1 tx)", async () => {
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const args = writeContractAsync.mock.calls[0][0] as {
      functionName: string;
      args: [Address[], bigint[]];
    };
    expect(args.functionName).toBe("setManualAllocation");
    expect(args.args[0]).toEqual([G_STAB.address]);
    expect(args.args[1]).toEqual([BigInt(TOTAL_BPS)]);
  });

  it("Balanced with preconditions met: setManualAllocation across all three gauges", async () => {
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: BALANCED, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const args = writeContractAsync.mock.calls[0][0] as {
      functionName: string;
      args: [Address[], bigint[]];
    };
    expect(args.functionName).toBe("setManualAllocation");
    expect(args.args[0]).toHaveLength(3);
    const sum = args.args[1].reduce((a, b) => a + b, 0n);
    expect(sum).toBe(BigInt(TOTAL_BPS));
  });

  it("Manual mode on fresh testnet wallet: faucet → delegate → setManualAllocation (3 txs, in order)", async () => {
    // #39: the full chained-precondition path. Without the auto-delegate
    // step the keeper would silently skip this user; without auto-faucet
    // their projected reward would be 0.
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["faucet", "delegate", "setManualAllocation"]);
    expect(waitForReceipt).toHaveBeenCalledTimes(2); // between faucet→delegate and delegate→vote
    expect(result.current.status).toBe("confirming");
  });

  it("Manual mode with veMEZO already, not delegated: delegate → setManualAllocation (2 txs)", async () => {
    veMezoBalanceState.value = 1_500n * 10n ** 18n;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["delegate", "setManualAllocation"]);
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  it("Custom strategy errors out — UI handles via the manual editor", async () => {
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: CUSTOM, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
  });

  it("Manual presets error gracefully when gauges haven't loaded yet", async () => {
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: [] }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/Gauge data/);
  });

  it("does nothing when user is undefined (wallet disconnected)", async () => {
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: undefined,
        gauges: ALL_GAUGES,
      }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("transitions to success when manual-mode receipt confirms", async () => {
    setPreconditionsMet();
    const { result, rerender } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.status).toBe("confirming");
    receiptState.isSuccess = true;
    rerender();
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("isDelegated reflects the on-chain read", async () => {
    isDelegatedState.value = true;
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: SET_AND_FORGET, user: USER, gauges: ALL_GAUGES }),
    );
    expect(result.current.isDelegated).toBe(true);
  });

  it("exposes currentStep so the activation modal can describe the in-flight tx", async () => {
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    // After all three steps complete, currentStep ends on "vote" (the
    // last write fired). The modal reads this throughout the flow.
    expect(result.current.currentStep).toBe("vote");
  });
});
