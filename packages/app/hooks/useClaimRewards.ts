"use client";

import { useEffect, useRef, useState } from "react";
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
  // Track which address initiated the in-flight claim. If the user switches
  // wallets before the receipt lands, the next-renders' `user` won't match
  // and we reset — wallet B never inherits wallet A's UI state or toast.
  // Codex P2 on PR #25 (round 1).
  const [claimUser, setClaimUser] = useState<Address | undefined>(undefined);
  // Codex P2 on PR #25 (round 2): the reset effect handles state already
  // committed via setTxHash/setPhase, but `writeContractAsync` is itself a
  // suspension point — if the wallet switches *while it's pending* (before
  // the hash returns), the resolved promise would still set txHash and
  // phase="confirming" for the abandoned wallet after the reset ran. A ref
  // is the only thing that survives across the await without triggering a
  // rerender, so we read it post-await to drop late completions on the floor.
  const abandonedRef = useRef(false);

  useEffect(() => {
    if (claimUser && user && claimUser.toLowerCase() !== user.toLowerCase()) {
      abandonedRef.current = true;
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
      setClaimUser(undefined);
    }
  }, [user, claimUser]);

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
      abandonedRef.current = false;
      try {
        setPhase("writing");
        setErrorMessage(undefined);
        setClaimUser(user);
        const hash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerClaimAbi,
          functionName: "claimRewards",
          args: [user],
        });
        // Wallet may have switched while the write was pending. The reset
        // effect already cleared state for the new user; don't re-pollute it.
        if (abandonedRef.current) return;
        setTxHash(hash);
        setPhase("confirming");
      } catch (err) {
        if (abandonedRef.current) return;
        setPhase("error");
        const e = err as { shortMessage?: string; message?: string };
        setErrorMessage(e.shortMessage ?? e.message ?? "Claim failed");
      }
    },
    reset: () => {
      abandonedRef.current = false;
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
      setClaimUser(undefined);
    },
  };
}
