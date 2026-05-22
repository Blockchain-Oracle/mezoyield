"use client";

import { useEffect, useRef, useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
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
  /**
   * True while a refetch of `pendingWei` is in flight (first-load or
   * post-claim refresh). Consumers must keep the claim CTA disabled while
   * this is true: otherwise a successful claim re-enables the button with
   * the stale pre-claim amount, and a second click submits a duplicate
   * tx that wastes gas or reverts. Codex P2 on PR #25 (round 4).
   */
  isRefetchingPending: boolean;
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
    // 10s staleTime: pending only changes on-chain (claim, keeper
    // vote rewards). 10s caps the per-render refetch storm without
    // making the dashboard feel stale to a user who just claimed —
    // the optimistic cache update on claim success (below) keeps the
    // UI fresh in that window.
    query: { enabled: !!user, staleTime: 10_000 },
  });

  // Codex pre-push P2 on STORY-009: STORY-009 BDD case "user claims
  // rewards in current epoch → YieldChart updates" requires the chart's
  // history query to reflect the new claim. useYieldHistory has 30s
  // staleTime + no input that changes mid-session, so without explicit
  // invalidation the chart shows pre-claim buckets until remount.
  // Plumbing the query client here decouples the producer (claim) from
  // the consumer (history) — the history hook never has to know about
  // claims.
  const queryClient = useQueryClient();

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
  // Codex P2 on PR #25 (round 3): a single shared "abandoned" flag is a
  // 1-bit signal — it can't distinguish "stale promise from before a switch"
  // from "live promise from a fresh claim". If A claims, switches to B, then
  // B claims, the start-of-claim reset would re-open the gate for A's still-
  // pending promise. Per-claim monotonic token solves this: each `claim()`
  // invocation captures `++claimTokenRef.current`, and the post-await check
  // `myToken === claimTokenRef.current` is true ONLY for the latest claim.
  // Wallet switches bump the token to invalidate any in-flight prior claim;
  // a new claim bumps it again and gets its own identity. Stale resolutions
  // can never pass the equality check.
  const claimTokenRef = useRef(0);

  useEffect(() => {
    if (claimUser && user && claimUser.toLowerCase() !== user.toLowerCase()) {
      claimTokenRef.current += 1;
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
      // Invalidate the yield-history query for the address that
      // *initiated* this claim — not necessarily the currently-connected
      // address. Codex P2 round 3 on PR #27: if the wallet disconnects
      // while the tx is still confirming, `user` becomes undefined and
      // an `if (user)` check would skip invalidation entirely; the chart
      // would then show stale pre-claim data after the user reconnects
      // within the 30s staleTime. `claimUser` is already tracked through
      // the writing → confirming transitions for the wallet-switch reset
      // logic, so we already know who owns this claim.
      if (claimUser) {
        void queryClient.invalidateQueries({
          queryKey: ["yield-history", claimUser],
        });
      }
    } else if (receipt.isError) {
      setPhase("error");
      setErrorMessage((receipt.error as Error | null)?.message ?? "Transaction reverted");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, receipt.isSuccess, receipt.isError]);

  return {
    pendingWei: (pendingQuery.data as bigint | undefined) ?? 0n,
    isLoadingPending: pendingQuery.isLoading,
    isRefetchingPending: pendingQuery.isFetching && !pendingQuery.isLoading,
    status: phase,
    txHash,
    errorMessage,
    claim: async () => {
      if (!user) return;
      const myToken = ++claimTokenRef.current;
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
        // Drop the result if a wallet switch (or a newer claim) has occurred
        // since this invocation captured its token.
        if (myToken !== claimTokenRef.current) return;
        setTxHash(hash);
        setPhase("confirming");
        // Optimistic update: zero the pending balance the instant the
        // user's wallet broadcasts the tx, before the receipt lands
        // (~12 s on mainnet, ~1–2 s testnet). Without this the dashboard
        // shows the old pending amount through the entire mining window
        // — users perceive the click as "did nothing" until the receipt
        // arrives and triggers refetch. queryClient.setQueryData updates
        // the same key wagmi's useReadContract caches under (`["readContract",
        // {address, functionName: "pending", args: [user]}, …]`); we use
        // wagmi's hashed key shape so the optimistic write hits the same
        // slot the live read pulls from. If the tx reverts, the receipt-
        // error branch re-refetches and reconciles back to the true value.
        const readContractQueryKey: unknown[] = [
          "readContract",
          {
            address: MATCHBOX_ADDRESS,
            functionName: "pending",
            args: [user],
            chainId: undefined,
          },
        ];
        queryClient.setQueryData(readContractQueryKey, 0n);
        // Also refetch via wagmi's own invalidation pathway so other
        // pending-reading hooks (e.g. PositionSummary derived metrics)
        // pick up the change immediately — belt-and-suspenders, since
        // the receipt-success effect also refetches.
        void pendingQuery.refetch();
      } catch (err) {
        if (myToken !== claimTokenRef.current) return;
        setPhase("error");
        const e = err as { shortMessage?: string; message?: string };
        setErrorMessage(e.shortMessage ?? e.message ?? "Claim failed");
      }
    },
    reset: () => {
      claimTokenRef.current += 1;
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
      setClaimUser(undefined);
    },
  };
}
