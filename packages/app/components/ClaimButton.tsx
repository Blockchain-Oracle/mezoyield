"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { useClaimRewards } from "@/hooks/useClaimRewards";
import { toast } from "sonner";

function formatMUSD(wei: bigint): string {
  const v = Number(formatUnits(wei, 18));
  if (v === 0) return "0";
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return v.toFixed(2);
}

/**
 * Single-click MUSD claim. Reads pending via `MockMatchbox.pending(user)`,
 * submits via `MezoYieldOptimizer.claimRewards(user)`. Disabled when
 * pending == 0 with the BDD-required label "No pending rewards".
 *
 * Surfaces success ("Rewards claimed! +X MUSD") and failure (revert
 * reason) toasts via sonner — same Toaster mount as OptimizeModal.
 */
export function ClaimButton() {
  const { address } = useAccount();
  const claim = useClaimRewards(address);

  useEffect(() => {
    if (claim.status === "success") {
      // Pending dropped to 0 after the receipt landed; format what was
      // claimed by reading the txHash slice (concise UX) — exact amount
      // would require parsing the RewardsClaimed event log; punt to the
      // toast's basic format for now.
      toast.success(
        `Rewards claimed! Tx: ${claim.txHash ? `${claim.txHash.slice(0, 10)}…` : "confirmed"}`,
      );
      claim.reset();
    } else if (claim.status === "error" && claim.errorMessage) {
      toast.error(`Claim failed: ${claim.errorMessage}`);
      claim.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.status, claim.txHash, claim.errorMessage]);

  if (!address) {
    return null;
  }

  const noRewards = claim.pendingWei === 0n;
  const inFlight = claim.status === "writing" || claim.status === "confirming";
  // After a successful claim, the receipt arrives BEFORE the pending refetch
  // settles. Without this gate the button briefly returns to enabled with the
  // stale pre-claim amount and a second click would submit a duplicate tx
  // that wastes gas or reverts. Codex P2 on PR #25 (round 4): treat "success
  // until refetch lands" as busy. `isRefetchingPending` covers the post-reset
  // window; `status === "success"` covers the brief pre-reset render.
  const settling = claim.status === "success" || claim.isRefetchingPending;
  const disabled = noRewards || inFlight || settling;

  let label: string;
  if (inFlight) {
    label = claim.status === "writing" ? "Confirming…" : "Settling…";
  } else if (settling) {
    label = "Settling…";
  } else if (noRewards) {
    label = "No pending rewards";
  } else {
    label = `Claim ${formatMUSD(claim.pendingWei)} MUSD`;
  }

  return (
    <Button
      data-testid="claim-button"
      onClick={() => void claim.claim()}
      disabled={disabled}
      className={
        noRewards
          ? "bg-muted text-muted-foreground"
          : "bg-success text-background hover:opacity-90"
      }
    >
      {label}
    </Button>
  );
}
