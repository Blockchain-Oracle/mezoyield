"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useClaimRewards } from "@/hooks/useClaimRewards";
import { ClaimButton } from "@/components/ClaimButton";

/**
 * Wraps the existing ClaimButton with a card that names the pending
 * amount on its own line. Sits at the bottom of /app/dashboard so the
 * "you have rewards to claim" CTA stays visible without scrolling.
 *
 * When the user is disconnected we render nothing — same convention as
 * ClaimButton — so the dashboard collapses naturally for first-time
 * visitors who haven't connected yet.
 */
export function PendingClaimCard() {
  const { address } = useAccount();
  const claim = useClaimRewards(address);

  if (!address) return null;

  const pendingMusd = Number(formatUnits(claim.pendingWei, 18));
  const hasPending = claim.pendingWei > 0n;

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Coins aria-hidden className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Pending rewards
              </span>
              <span className="font-mono text-2xl font-semibold text-foreground">
                {hasPending ? `${pendingMusd.toFixed(2)} MUSD` : "0 MUSD"}
              </span>
              <span className="text-xs text-muted-foreground">
                {hasPending
                  ? "Claim to receive MUSD in your wallet"
                  : "Your claimable balance accrues each epoch"}
              </span>
            </div>
          </div>
          <ClaimButton />
        </div>
      </CardContent>
    </Card>
  );
}
