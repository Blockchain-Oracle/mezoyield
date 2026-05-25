import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Mock harness for `useActivateStrategy` covering the chained-precondition
 * flow:
 *   - testnet: `MockVeMezo.mint(user, amount)` (when balance==0) → delegate
 *     → setManualAllocation (manual mode only)
 *   - mainnet: `MEZO.approve` (if allowance < amount) → `VeMEZO.createLock`
 *     (when balance==0) → delegate → `VeMEZO.setApprovalForAll` (if not
 *     already approved) → setManualAllocation (manual mode only)
 *
 * The hook reads two contracts via wagmi's `useReadContract` (isDelegated
 * and veMEZO balanceOf — discriminated here by `functionName`) and an
 * arbitrary number of additional reads via `publicClient.readContract`
 * (mainnet allowance, isApprovedForAll, MEZO balanceOf — discriminated by
 * `${address}:${functionName}`). Each write is awaited via
 * `publicClient.waitForTransactionReceipt` between steps.
 */

// ─── Mock @/lib/contracts so MEZO_NETWORK + addresses are deterministic ──
// The constants are inlined into the factory because `vi.mock` is hoisted
// to the top of the file and can't see `const` declarations above it.
vi.mock("@/lib/contracts", () => ({
  OPTIMIZER_ADDRESS: "0x0000000000000000000000000000000000000111",
  GAUGE_CONTROLLER_ADDRESS: "0x0000000000000000000000000000000000000222",
  VE_MEZO_ADDRESS: "0x0000000000000000000000000000000000000333",
  VE_MEZO_NFT_ADDRESS: "0x0000000000000000000000000000000000000444",
  MEZO_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000555",
  MEZO_CHAIN_ID: 31611,
  MEZO_NETWORK: "testnet",
  MEZO_TESTNET_CHAIN_ID: 31611,
}));

// Re-declared for use INSIDE tests (the factory above is the source of
// truth for the hook's imports; these mirror it for assertion lookups).
const OPTIMIZER = "0x0000000000000000000000000000000000000111" as const;
const GAUGE_CTRL = "0x0000000000000000000000000000000000000222" as const;
const VE_MEZO = "0x0000000000000000000000000000000000000333" as const;
const VE_MEZO_NFT = "0x0000000000000000000000000000000000000444" as const;
const MEZO_TOKEN = "0x0000000000000000000000000000000000000555" as const;
// Silence unused warnings — OPTIMIZER/GAUGE_CTRL/VE_MEZO are kept for
// future tests that assert on those addresses; remove if still unused
// after the next test pass.
void OPTIMIZER;
void GAUGE_CTRL;
void VE_MEZO;

const writeContractAsync = vi.fn(
  async (_args: unknown): Promise<`0x${string}`> =>
    `0x${Math.random().toString(16).slice(2, 10).padEnd(64, "0")}` as `0x${string}`,
);
const isDelegatedState: { value?: boolean } = { value: false };
// `value` is `undefined` while the read is in-flight; the hook must
// treat that as "loaded === false" and refuse to act. Once the read
// resolves the value is `bigint`. Tests toggle this to exercise the
// loading-vs-zero distinction.
const veMezoBalanceState: { value: bigint | undefined } = { value: 0n };
const refetchDelegated = vi.fn();
const refetchVeMezoBalance = vi.fn();
// Per-hash receipt status: defaults to "success" for hashes not in the
// map. Set entries with `setReceiptStatus(hash, "reverted")` to test
// the abort-on-revert path. We can't pre-key by hash because the
// `writeContractAsync` mock generates random hashes, so the map is
// keyed by *call index* via a counter the mock increments. Tests
// declare expected statuses by call order.
const receiptStatusByCall: ("success" | "reverted")[] = [];
let waitForReceiptCallIndex = 0;
const waitForReceipt = vi.fn(async () => {
  const status = receiptStatusByCall[waitForReceiptCallIndex] ?? "success";
  waitForReceiptCallIndex += 1;
  return { status };
});
const receiptState: {
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  data?: { status: "success" | "reverted" };
} = {
  isSuccess: false,
  isError: false,
  error: null,
  data: undefined,
};

// publicClient.readContract returns keyed by `${address.toLowerCase()}:${functionName}`.
// Tests seed expected values via `setPublicRead(addr, fn, value)`.
const publicReads = new Map<string, unknown>();
const publicReadContract = vi.fn(
  async (args: { address: string; functionName: string }) => {
    const key = `${args.address.toLowerCase()}:${args.functionName}`;
    return publicReads.get(key);
  },
);
function setPublicRead(address: string, functionName: string, value: unknown) {
  publicReads.set(`${address.toLowerCase()}:${functionName}`, value);
}

// Toggleable: tests that need to exercise the "no RPC client" failure
// path flip this to `false` so `usePublicClient` returns undefined.
const publicClientAvailable: { value: boolean } = { value: true };

vi.mock("wagmi", () => ({
  useReadContract: ({
    functionName,
  }: {
    functionName?: string;
  } = {}) => {
    if (functionName === "balanceOf") {
      return {
        data: veMezoBalanceState.value,
        isLoading: false,
        refetch: refetchVeMezoBalance,
      };
    }
    return {
      data: isDelegatedState.value,
      isLoading: false,
      refetch: refetchDelegated,
    };
  },
  useWriteContract: () => ({ writeContractAsync }),
  useWaitForTransactionReceipt: () => receiptState,
  usePublicClient: () =>
    publicClientAvailable.value
      ? {
          waitForTransactionReceipt: waitForReceipt,
          readContract: publicReadContract,
        }
      : undefined,
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

const ONE_MEZO = 10n ** 18n;
const LOCK_500 = 500n * ONE_MEZO;

/**
 * Default world: connected wallet ALREADY has 1000 veMEZO and IS already
 * delegated. Branch tests override flags in their setup.
 */
function setPreconditionsMet() {
  isDelegatedState.value = true;
  veMezoBalanceState.value = 1_000n * ONE_MEZO;
}

describe("useActivateStrategy", () => {
  beforeEach(() => {
    writeContractAsync.mockClear();
    refetchDelegated.mockClear();
    refetchVeMezoBalance.mockClear();
    waitForReceipt.mockClear();
    publicReadContract.mockClear();
    publicReads.clear();
    receiptStatusByCall.length = 0;
    waitForReceiptCallIndex = 0;
    isDelegatedState.value = false;
    veMezoBalanceState.value = 0n;
    receiptState.isSuccess = false;
    receiptState.isError = false;
    receiptState.error = null;
    receiptState.data = undefined;
    publicClientAvailable.value = true;
  });

  // ─── Testnet path ────────────────────────────────────────────────

  describe("testnet", () => {
    it("Set & Forget with preconditions met: short-circuits to success, no tx", async () => {
      setPreconditionsMet();
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
      );
      await act(async () => {
        await result.current.activate();
      });
      expect(writeContractAsync).not.toHaveBeenCalled();
      expect(result.current.status).toBe("success");
    });

    it("Set & Forget on fresh wallet with amount: mint → delegate (2 txs)", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
      );
      await act(async () => {
        await result.current.activate({ lockAmountWei: LOCK_500 });
      });
      const calls = writeContractAsync.mock.calls.map(
        (c) => (c[0] as { functionName: string }).functionName,
      );
      expect(calls).toEqual(["mint", "delegate"]);
      // The mint call's args should reflect the caller-supplied amount.
      const mintArgs = writeContractAsync.mock.calls[0][0] as {
        functionName: string;
        args: [Address, bigint];
      };
      expect(mintArgs.args[0]).toBe(USER);
      expect(mintArgs.args[1]).toBe(LOCK_500);
      expect(result.current.status).toBe("success");
    });

    it("Set & Forget with veMEZO but not delegated: delegate only (1 tx)", async () => {
      veMezoBalanceState.value = LOCK_500;
      isDelegatedState.value = false;
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
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

    it("Stability Max with preconditions met: setManualAllocation only (1 tx)", async () => {
      setPreconditionsMet();
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: STAB_MAX,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
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
        useActivateStrategy({
          preset: BALANCED,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
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

    it("Manual mode on fresh wallet with amount: mint → delegate → setManualAllocation", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: STAB_MAX,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
      );
      await act(async () => {
        await result.current.activate({ lockAmountWei: LOCK_500 });
      });
      const calls = writeContractAsync.mock.calls.map(
        (c) => (c[0] as { functionName: string }).functionName,
      );
      expect(calls).toEqual(["mint", "delegate", "setManualAllocation"]);
      expect(result.current.status).toBe("confirming");
    });

    it("fresh wallet with NO amount supplied: clear error, no tx fires", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "testnet",
        }),
      );
      await act(async () => {
        await result.current.activate();
      });
      expect(writeContractAsync).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toMatch(/voting-power amount/i);
    });
  });

  // ─── Mainnet path ────────────────────────────────────────────────

  describe("mainnet", () => {
    function seedMainnetReads({
      mezoBalance,
      allowance,
      nftApproved,
    }: {
      mezoBalance: bigint;
      allowance: bigint;
      nftApproved: boolean;
    }) {
      setPublicRead(MEZO_TOKEN, "balanceOf", mezoBalance);
      setPublicRead(MEZO_TOKEN, "allowance", allowance);
      setPublicRead(VE_MEZO_NFT, "isApprovedForAll", nftApproved);
    }

    it("fresh mainnet wallet, 1 MEZO available: approve → createLock → delegate → setApprovalForAll", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      seedMainnetReads({
        mezoBalance: ONE_MEZO,
        allowance: 0n,
        nftApproved: false,
      });
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate({ lockAmountWei: ONE_MEZO });
      });
      const calls = writeContractAsync.mock.calls.map(
        (c) => (c[0] as { functionName: string }).functionName,
      );
      expect(calls).toEqual([
        "approve",
        "createLock",
        "delegate",
        "setApprovalForAll",
      ]);
      expect(result.current.status).toBe("success");
    });

    it("allowance already sufficient: skips approve, fires lock → delegate → setApprovalForAll", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      seedMainnetReads({
        mezoBalance: ONE_MEZO,
        allowance: ONE_MEZO, // ← pre-existing approval covers full amount
        nftApproved: false,
      });
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate({ lockAmountWei: ONE_MEZO });
      });
      const calls = writeContractAsync.mock.calls.map(
        (c) => (c[0] as { functionName: string }).functionName,
      );
      expect(calls).toEqual(["createLock", "delegate", "setApprovalForAll"]);
    });

    it("veMEZO already > 0 and delegated: only setApprovalForAll fires if NFT not yet approved", async () => {
      veMezoBalanceState.value = LOCK_500;
      isDelegatedState.value = true;
      seedMainnetReads({
        mezoBalance: 0n, // doesn't matter, lock branch is skipped
        allowance: 0n,
        nftApproved: false,
      });
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate();
      });
      const calls = writeContractAsync.mock.calls.map(
        (c) => (c[0] as { functionName: string }).functionName,
      );
      expect(calls).toEqual(["setApprovalForAll"]);
      expect(result.current.status).toBe("success");
    });

    it("veMEZO already > 0 and delegated and NFT-approved: no tx, immediate success", async () => {
      veMezoBalanceState.value = LOCK_500;
      isDelegatedState.value = true;
      seedMainnetReads({
        mezoBalance: 0n,
        allowance: 0n,
        nftApproved: true,
      });
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate();
      });
      expect(writeContractAsync).not.toHaveBeenCalled();
      expect(result.current.status).toBe("success");
    });

    it("MAX-race clamp: input > current MEZO balance is clamped to balance before approve", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      // User typed MAX based on a stale balance (2 MEZO); a transfer-out
      // dropped the on-chain balance to 1 MEZO between read and submit.
      seedMainnetReads({
        mezoBalance: ONE_MEZO,
        allowance: 0n,
        nftApproved: true,
      });
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate({ lockAmountWei: 2n * ONE_MEZO });
      });
      const approveCall = writeContractAsync.mock.calls.find(
        (c) => (c[0] as { functionName: string }).functionName === "approve",
      );
      expect(approveCall).toBeDefined();
      const approveArgs = approveCall![0] as {
        functionName: string;
        args: [Address, bigint];
      };
      // Clamped to the on-chain MEZO balance (1 MEZO), not the user's
      // requested 2 MEZO.
      expect(approveArgs.args[1]).toBe(ONE_MEZO);
    });

    it("zero MEZO balance, even with lockAmountWei supplied: errors with bridge-or-swap message", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      seedMainnetReads({
        mezoBalance: 0n,
        allowance: 0n,
        nftApproved: false,
      });
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate({ lockAmountWei: ONE_MEZO });
      });
      expect(writeContractAsync).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toMatch(/bridge or swap/i);
    });

    it("fresh mainnet wallet with NO amount supplied: clear error, no tx fires", async () => {
      veMezoBalanceState.value = 0n;
      isDelegatedState.value = false;
      const { result } = renderHook(() =>
        useActivateStrategy({
          preset: SET_AND_FORGET,
          user: USER,
          gauges: ALL_GAUGES,
          network: "mainnet",
        }),
      );
      await act(async () => {
        await result.current.activate();
      });
      expect(writeContractAsync).not.toHaveBeenCalled();
      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toMatch(/MEZO to lock/i);
    });
  });

  // ─── Edge cases (network-agnostic) ───────────────────────────────

  it("Custom strategy errors out — UI handles via the manual editor", async () => {
    setPreconditionsMet();
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: CUSTOM,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
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
      useActivateStrategy({
        preset: STAB_MAX,
        user: USER,
        gauges: [],
        network: "testnet",
      }),
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
        network: "testnet",
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
      useActivateStrategy({
        preset: STAB_MAX,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    await act(async () => {
      await result.current.activate();
    });
    expect(result.current.status).toBe("confirming");
    receiptState.isSuccess = true;
    receiptState.data = { status: "success" };
    rerender();
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("isDelegated reflects the on-chain read", async () => {
    isDelegatedState.value = true;
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    expect(result.current.isDelegated).toBe(true);
  });

  it("veMezoBalance is surfaced so the modal can render the Set-Voting-Power section", async () => {
    veMezoBalanceState.value = 0n;
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    expect(result.current.veMezoBalance).toBe(0n);
  });

  // ─── Revert-detection + loading-state regression tests (Codex round 1) ──

  it("testnet: reverted mint aborts the chain — delegate never fires", async () => {
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    // First receipt (mint) reverts. Without the status check, the hook
    // would fall through into `delegate` and burn gas a second time.
    receiptStatusByCall.push("reverted");
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    await act(async () => {
      await result.current.activate({ lockAmountWei: LOCK_500 });
    });
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["mint"]); // ← only mint fired; delegate aborted
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/reverted/i);
  });

  it("mainnet: reverted createLock aborts the chain — delegate never fires", async () => {
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    setPublicRead(MEZO_TOKEN, "balanceOf", ONE_MEZO);
    setPublicRead(MEZO_TOKEN, "allowance", ONE_MEZO);
    setPublicRead(VE_MEZO_NFT, "isApprovedForAll", true);
    // Allowance is pre-set, so no approve fires. Receipts: [createLock]
    // → revert. Without the status check, delegate would still go.
    receiptStatusByCall.push("reverted");
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "mainnet",
      }),
    );
    await act(async () => {
      await result.current.activate({ lockAmountWei: ONE_MEZO });
    });
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["createLock"]);
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/reverted/i);
  });

  it("balance still loading (undefined): activate refuses to act, no tx fires", async () => {
    // Returning user with an existing lock opens the modal during the
    // in-flight read. Hook must refuse to act — otherwise it could
    // submit an unnecessary lock for funds the user already locked.
    veMezoBalanceState.value = undefined;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "mainnet",
      }),
    );
    expect(result.current.veMezoBalanceLoaded).toBe(false);
    await act(async () => {
      await result.current.activate({ lockAmountWei: ONE_MEZO });
    });
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/Still reading/i);
  });

  it("no publicClient available: hook errors instead of advancing without receipt confirmation", async () => {
    // If usePublicClient() returns undefined (wallet disconnected
    // mid-flow), waitOrRevert must fail closed — otherwise subsequent
    // steps would fire without on-chain confirmation of the previous.
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    publicClientAvailable.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    await act(async () => {
      await result.current.activate({ lockAmountWei: LOCK_500 });
    });
    // mint fired (the write itself goes through writeContractAsync,
    // which is independent of publicClient), but waitOrRevert threw
    // before delegate could be queued.
    const calls = writeContractAsync.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(calls).toEqual(["mint"]);
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/no RPC client/i);
  });

  it("veMezoBalanceLoaded reflects whether the read has resolved", async () => {
    veMezoBalanceState.value = undefined;
    const { result, rerender } = renderHook(() =>
      useActivateStrategy({
        preset: SET_AND_FORGET,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    expect(result.current.veMezoBalanceLoaded).toBe(false);
    veMezoBalanceState.value = 0n;
    rerender();
    expect(result.current.veMezoBalanceLoaded).toBe(true);
  });

  it("exposes currentStep so the activation modal can describe the in-flight tx", async () => {
    veMezoBalanceState.value = 0n;
    isDelegatedState.value = false;
    const { result } = renderHook(() =>
      useActivateStrategy({
        preset: STAB_MAX,
        user: USER,
        gauges: ALL_GAUGES,
        network: "testnet",
      }),
    );
    await act(async () => {
      await result.current.activate({ lockAmountWei: LOCK_500 });
    });
    // After mint → delegate → vote, currentStep ends on "vote".
    expect(result.current.currentStep).toBe("vote");
  });
});
