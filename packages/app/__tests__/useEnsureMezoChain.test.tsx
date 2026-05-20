import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Regression suite for #38 — auto-switch/add Mezo chain on wallet
 * connect. The hook owns the "single auto-fire on mismatch" semantics
 * and the manual retry surface; these tests pin both.
 */
const accountState: { isConnected: boolean } = { isConnected: false };
const chainIdState: { value: number } = { value: 1 };
const switchChainMock = vi.fn(
  (
    _args: { chainId: number },
    options?: { onError?: (e: Error) => void },
  ) => {
    void options;
  },
);
const switchPendingState: { value: boolean } = { value: false };
const switchErrorState: { value: Error | null } = { value: null };

vi.mock("wagmi", () => ({
  useAccount: () => accountState,
  useChainId: () => chainIdState.value,
  useSwitchChain: () => ({
    switchChain: switchChainMock,
    isPending: switchPendingState.value,
    error: switchErrorState.value,
  }),
}));

import { useEnsureMezoChain } from "@/hooks/useEnsureMezoChain";
import { MEZO_CHAIN_ID } from "@/lib/contracts";

describe("useEnsureMezoChain", () => {
  beforeEach(() => {
    accountState.isConnected = false;
    chainIdState.value = 1;
    switchChainMock.mockClear();
    switchPendingState.value = false;
    switchErrorState.value = null;
  });

  it("Given disconnected wallet, exposes isOnMezo=false and never auto-fires", () => {
    const { result } = renderHook(() => useEnsureMezoChain());
    expect(result.current.isOnMezo).toBe(false);
    expect(result.current.isMismatched).toBe(false);
    expect(switchChainMock).not.toHaveBeenCalled();
  });

  it("Given connected on Ethereum mainnet, auto-fires switchChain to MEZO_CHAIN_ID once", () => {
    accountState.isConnected = true;
    chainIdState.value = 1; // Ethereum mainnet
    renderHook(() => useEnsureMezoChain());
    expect(switchChainMock).toHaveBeenCalledTimes(1);
    expect(switchChainMock.mock.calls[0][0]).toEqual({
      chainId: MEZO_CHAIN_ID,
    });
  });

  it("Given connected and already on Mezo, exposes isOnMezo=true and never fires", () => {
    accountState.isConnected = true;
    chainIdState.value = MEZO_CHAIN_ID;
    const { result } = renderHook(() => useEnsureMezoChain());
    expect(result.current.isOnMezo).toBe(true);
    expect(result.current.isMismatched).toBe(false);
    expect(switchChainMock).not.toHaveBeenCalled();
  });

  it("Re-render after auto-fire on same mismatch does NOT re-fire", () => {
    accountState.isConnected = true;
    chainIdState.value = 1;
    const { rerender } = renderHook(() => useEnsureMezoChain());
    expect(switchChainMock).toHaveBeenCalledTimes(1);
    rerender();
    rerender();
    expect(switchChainMock).toHaveBeenCalledTimes(1);
  });

  it("Manual ensureMezo() always re-fires (the retry button surface)", () => {
    accountState.isConnected = true;
    chainIdState.value = 1;
    const { result } = renderHook(() => useEnsureMezoChain());
    expect(switchChainMock).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.ensureMezo();
    });
    expect(switchChainMock).toHaveBeenCalledTimes(2);
  });

  it("Surfaces switch errors so the banner can render them", () => {
    accountState.isConnected = true;
    chainIdState.value = 1;
    switchErrorState.value = new Error("User rejected request");
    const { result } = renderHook(() => useEnsureMezoChain());
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toMatch(/rejected/);
  });
});
