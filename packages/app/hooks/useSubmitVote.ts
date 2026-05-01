"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { OPTIMIZER_ADDRESS } from "@/lib/contracts";
import type { AllocationEntry } from "@/lib/optimize";

const optimizerWriteAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "castOptimalVote",
    inputs: [
      { name: "gauges", type: "address[]" },
      { name: "weights", type: "uint256[]" },
    ],
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
] as const;

type SubmitMode = "auto" | "manual";

export type SubmitVoteState = {
  /** "Submit" → "Confirming…" → "Settling…" → "Success" / "Failed" */
  status: "idle" | "writing" | "confirming" | "success" | "error";
  /** Transaction hash once the wallet returns it. */
  txHash?: `0x${string}`;
  /** Human-readable revert reason from viem's BaseError, if any. */
  errorMessage?: string;
  /**
   * Submit a vote. Both Auto and Manual modes call `setManualAllocation`
   * — the only difference is HOW the weights are computed (autoAllocate
   * over live gauge data vs the user's slider values). `setManualAllocation`
   * is caller-authorized so any connected wallet can pin its own
   * allocation; `castOptimalVote` is keeper-only and intentionally NOT
   * exposed in the user UI. Codex P1 on PR #24 caught that routing auto
   * through `castOptimalVote` would have reverted for any non-keeper
   * wallet — i.e. every regular user.
   */
  submit: (mode: SubmitMode, allocation: AllocationEntry[]) => Promise<void>;
  reset: () => void;
};

/**
 * Wraps wagmi's `useWriteContract` + `useWaitForTransactionReceipt` for the
 * vote submission flow. Returns a single `submit(mode, allocation)` entry
 * point. Both modes route through `setManualAllocation` (caller-authorized);
 * a future keeper-bot story can add a separate path for `castOptimalVote`.
 *
 * §14: no polling, no synthesized state. wagmi's receipt waiter is the
 * single source of truth for confirmation.
 */
export function useSubmitVote(): SubmitVoteState {
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<"idle" | "writing" | "confirming" | "success" | "error">(
    "idle",
  );

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Roll the receipt status into our phase enum (without an extra useEffect:
  // we read it on every render and only update state when it changes).
  if (txHash && phase === "confirming") {
    if (receipt.isSuccess) setPhase("success");
    else if (receipt.isError) {
      setPhase("error");
      setErrorMessage((receipt.error as Error | null)?.message ?? "Transaction reverted");
    }
  }

  return {
    status: phase,
    txHash,
    errorMessage,
    submit: async (_mode, allocation) => {
      try {
        setPhase("writing");
        setErrorMessage(undefined);
        const gauges = allocation.map((e) => e.gauge) as readonly `0x${string}`[];
        const weights = allocation.map((e) => BigInt(e.weightBps));
        // Always route through `setManualAllocation` — caller-authorized,
        // works for any connected wallet. `castOptimalVote` is keeper-only
        // and reserved for the automation path (a future keeper-bot story).
        const hash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerWriteAbi,
          functionName: "setManualAllocation",
          args: [gauges, weights] as never,
        });
        setTxHash(hash);
        setPhase("confirming");
      } catch (err) {
        setPhase("error");
        // viem BaseError exposes `shortMessage` for the user-readable
        // revert reason; fall back to .message otherwise.
        const e = err as { shortMessage?: string; message?: string };
        setErrorMessage(e.shortMessage ?? e.message ?? "Transaction failed");
      }
    },
    reset: () => {
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
    },
  };
}
