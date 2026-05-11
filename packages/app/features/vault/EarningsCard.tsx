"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useYieldHistory } from "@/hooks/useYieldHistory";

/**
 * Cumulative MUSD earned to date — sum across all `RewardsClaimed`
 * events the optimizer has emitted for this user. Sourced from
 * useYieldHistory's already-fetched + bucketed log set; we just
 * re-sum the per-epoch amounts.
 *
 * Differs from the dashboard's PendingClaimCard: that one shows
 * UNCLAIMED rewards still sitting in Matchbox; this one shows
 * total CLAIMED rewards over the user's lifetime.
 */
export function EarningsCard() {
  const { address, isConnected } = useAccount();
  const { epochs, isLoading } = useYieldHistory();

  const totalWei = epochs.reduce((acc, b) => acc + b.musdWei, 0n);
  const totalMusd = Number(formatUnits(totalWei, 18));

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <TrendingUp aria-hidden className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Total MUSD earned
            </span>
            <span className="font-mono text-3xl font-semibold text-foreground">
              {!isConnected
                ? "—"
                : isLoading
                  ? "…"
                  : `${totalMusd.toFixed(2)} MUSD`}
            </span>
            <span className="text-xs text-muted-foreground">
              {isConnected
                ? "Cumulative across all RewardsClaimed events for your address."
                : "Connect to see your lifetime earnings."}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
