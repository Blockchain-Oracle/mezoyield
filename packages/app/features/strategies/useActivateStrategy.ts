"use client";

import { useEffect, useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { OPTIMIZER_ADDRESS } from "@/lib/contracts";
import type { Address } from "@/lib/types";
import type { Gauge } from "@/lib/types";
import {
  type StrategyPreset,
  type AllocationEntry,
} from "./presets";

/**
 * Activate a strategy preset on the optimizer.
 *
 *   - Set & Forget (delegate mode): submits `delegate(user)`. The
 *     keeper bot picks up subsequent epoch votes via `castOptimalVote`.
 *   - Static (manual mode): computes allocation from live `gauges` and
 *     submits `setManualAllocation(gauges, weights)`.
 *   - Custom (custom mode): rejects — UI handles via the manual editor.
 *
 * Mirrors `useClaimRewards` shape: phase machine + last txHash +
 * error message + reset(). One-tx flow, so simpler than claim's
 * write+receipt pair (we use `useWaitForTransactionReceipt` for the
 * confirm phase too so the UI can show "Settling…" before flipping
 * to "Activated").
 *
 * Reads `isDelegated[user]` so the UI can skip the delegate prompt
 * when the user is already opted in.
 */

const optimizerActivateAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "delegate",
    inputs: [{ name: "user", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setManualAllocation",
    inputs: [
      { name: "gauges", type: "address[]" },
      { name: "weights", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isDelegated",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type ActivationStatus =
  | "idle"
  | "writing"
  | "confirming"
  | "success"
  | "error";

export type ActivationState = {
  status: ActivationStatus;
  txHash?: `0x${string}`;
  errorMessage?: string;
  /** True iff the connected user has previously called `delegate()`. */
  isDelegated: boolean;
  /** Computed allocation for the chosen preset against current `gauges`. */
  preview: AllocationEntry[];
  activate: () => Promise<void>;
  reset: () => void;
};

interface UseActivateStrategyArgs {
  preset: StrategyPreset;
  user: Address | undefined;
  gauges: Gauge[];
}

export function useActivateStrategy({
  preset,
  user,
  gauges,
}: UseActivateStrategyArgs): ActivationState {
  const delegatedQuery = useReadContract({
    address: OPTIMIZER_ADDRESS,
    abi: optimizerActivateAbi,
    functionName: "isDelegated",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<ActivationStatus>("idle");

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Drive the success/error transitions off the receipt. useEffect so
  // we don't setState during render.
  useEffect(() => {
    if (phase !== "confirming") return;
    if (receipt.isSuccess) {
      setPhase("success");
      void delegatedQuery.refetch();
    } else if (receipt.isError) {
      setPhase("error");
      setErrorMessage(
        (receipt.error as Error | null)?.message ?? "Transaction reverted",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, receipt.isSuccess, receipt.isError]);

  const preview =
    preset.execution.mode === "manual"
      ? preset.execution.allocation(gauges)
      : [];

  const activate = async (): Promise<void> => {
    if (!user) return;
    setErrorMessage(undefined);
    try {
      if (preset.execution.mode === "delegate") {
        // Skip the delegate tx when the user is already opted in.
        // `delegate(user)` is idempotent on-chain (the contract just
        // sets `isDelegated[user] = true`), so a second call would
        // succeed but pop a redundant MetaMask prompt for no behavioral
        // change. Surfaced by Abu in manual testing on testnet — the
        // hook reads `isDelegated` but never short-circuited the write.
        if (delegatedQuery.data) {
          setPhase("success");
          return;
        }
        setPhase("writing");
        const hash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerActivateAbi,
          functionName: "delegate",
          args: [user],
        });
        setTxHash(hash);
        setPhase("confirming");
        return;
      }
      if (preset.execution.mode === "manual") {
        const allocation = preset.execution.allocation(gauges);
        if (allocation.length === 0) {
          setPhase("error");
          setErrorMessage(
            "Gauge data hasn't loaded yet — wait a moment and retry.",
          );
          return;
        }
        setPhase("writing");
        const hash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerActivateAbi,
          functionName: "setManualAllocation",
          args: [
            allocation.map((e) => e.gauge) as readonly Address[],
            allocation.map((e) => BigInt(e.weightBps)),
          ],
        });
        setTxHash(hash);
        setPhase("confirming");
        return;
      }
      // Custom mode is a UI-side decision; this hook should never be
      // called for it. Surface a clear error if it happens.
      setPhase("error");
      setErrorMessage(
        "Custom strategy is configured via the manual editor, not this activate flow.",
      );
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setPhase("error");
      setErrorMessage(e.shortMessage ?? e.message ?? "Activation failed");
    }
  };

  return {
    status: phase,
    txHash,
    errorMessage,
    isDelegated: !!delegatedQuery.data,
    preview,
    activate,
    reset: () => {
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
    },
  };
}
