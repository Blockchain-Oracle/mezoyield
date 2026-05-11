"use client";

import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaderboardTable } from "@/features/leaderboard/LeaderboardTable";

export default function LeaderboardPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Leaderboard
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Top earners on MezoYield
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ranked by total MUSD claimed via the optimizer. Aggregated live from
          on-chain RewardsClaimed events — no off-chain database. Your row
          highlights when you&rsquo;re connected.
        </p>
      </header>
      <LeaderboardTable />
    </div>
  );
}
