"use client";

import { useEffect, useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { OPTIMIZER_ADDRESS, MATCHBOX_ADDRESS } from "@/lib/contracts";
import { matchboxAbi } from "@/lib/abi";
import type { Address } from "@/lib/types";

const optimizerClaimAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claimRewards",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

export type ClaimState = {
  /** Pending MUSD amount in wei. 0n when disconnected or no rewards. */
  pendingWei: bigint;
  isLoadingPending: boolean;
  /** "idle" → "writing" → "confirming" → "success" / "error". */
  status: "idle" | "writing" | "confirming" | "success" | "error";
  txHash?: `0x${string}`;
  errorMessage?: string;
  /** Submit the claim transaction for `user`. Anyone can claim FOR a user. */
  claim: () => Promise<void>;
  reset: () => void;
};

/**
 * Reads pending MUSD via `MockMatchbox.pending(user)` and submits the claim
 * via `MezoYieldOptimizer.claimRewards(user)`. The optimizer forwards to
 * the matchbox and emits `RewardsClaimed` so on-chain observers can audit;
 * the wagmi receipt waiter signals confirmation.
 *
 * §14: pending balance comes from on-chain state, never synthesized.
 * 0n is a valid disconnected/no-rewards signal — `ClaimButton` disables
 * itself accordingly.
 */
export function useClaimRewards(user: Address | undefined): ClaimState {
  const pendingQuery = useReadContract({
    address: MATCHBOX_ADDRESS,
    abi: matchboxAbi,
    functionName: "pending",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

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

  // Refresh the pending balance when a claim confirms (it drops to 0).
  useEffect(() => {
    if (phase !== "confirming") return;
    if (receipt.isSuccess) {
      setPhase("success");
      void pendingQuery.refetch();
    } else if (receipt.isError) {
      setPhase("error");
      setErrorMessage((receipt.error as Error | null)?.message ?? "Transaction reverted");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, receipt.isSuccess, receipt.isError]);

  return {
    pendingWei: (pendingQuery.data as bigint | undefined) ?? 0n,
    isLoadingPending: pendingQuery.isLoading,
    status: phase,
    txHash,
    errorMessage,
    claim: async () => {
      if (!user) return;
      try {
        setPhase("writing");
        setErrorMessage(undefined);
        const hash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerClaimAbi,
          functionName: "claimRewards",
          args: [user],
        });
        setTxHash(hash);
        setPhase("confirming");
      } catch (err) {
        setPhase("error");
        const e = err as { shortMessage?: string; message?: string };
        setErrorMessage(e.shortMessage ?? e.message ?? "Claim failed");
      }
    },
    reset: () => {
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
    },
  };
}
