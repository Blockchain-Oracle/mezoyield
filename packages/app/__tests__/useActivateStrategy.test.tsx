import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const writeContractAsync = vi.fn(
  async (_args: unknown): Promise<`0x${string}`> => "0xfeed",
);
const isDelegatedState: { value?: boolean } = { value: false };
const refetchDelegated = vi.fn();
const receiptState: { isSuccess: boolean; isError: boolean; error: Error | null } = {
  isSuccess: false,
  isError: false,
  error: null,
};

vi.mock("wagmi", () => ({
  useReadContract: () => ({
    data: isDelegatedState.value,
    isLoading: false,
    refetch: refetchDelegated,
  }),
  useWriteContract: () => ({ writeContractAsync }),
  useWaitForTransactionReceipt: () => receiptState,
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

describe("useActivateStrategy", () => {
  beforeEach(() => {
    writeContractAsync.mockClear();
    refetchDelegated.mockClear();
    isDelegatedState.value = false;
    receiptState.isSuccess = false;
    receiptState.isError = false;
    receiptState.error = null;
  });

  it("Set & Forget submits delegate(user) — single tx, no allocation arg", async () => {
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: SET_AND_FORGET, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    const args = writeContractAsync.mock.calls[0][0] as {
      functionName: string;
      args: unknown[];
    };
    expect(args.functionName).toBe("delegate");
    expect(args.args).toEqual([USER]);
    expect(result.current.status).toBe("confirming");
  });

  it("Stability Max submits setManualAllocation([Stab], [10000])", async () => {
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

  it("Balanced 40/30/30 submits setManualAllocation across all three gauges", async () => {
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: BALANCED, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    const args = writeContractAsync.mock.calls[0][0] as {
      functionName: string;
      args: [Address[], bigint[]];
    };
    expect(args.functionName).toBe("setManualAllocation");
    expect(args.args[0]).toHaveLength(3);
    expect(args.args[1].reduce((a, b) => a + b, 0n)).toBe(BigInt(TOTAL_BPS));
  });

  it("Custom strategy errors out — UI is supposed to handle it via the manual editor", async () => {
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: CUSTOM, user: USER, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/manual editor/i);
  });

  it("manual presets error gracefully when gauges haven't loaded yet", async () => {
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: STAB_MAX, user: USER, gauges: [] }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/gauge data/i);
  });

  it("does nothing when user is undefined (wallet disconnected)", async () => {
    const { result } = renderHook(() =>
      useActivateStrategy({ preset: SET_AND_FORGET, user: undefined, gauges: ALL_GAUGES }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("transitions to success when receipt confirms", async () => {
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
});
