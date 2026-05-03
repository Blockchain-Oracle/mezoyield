"use client";

import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { BribeTable } from "@/features/bribe-market/BribeTable";

export default function BribeMarketPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Bribe Market
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          What&rsquo;s being bribed this epoch
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live read of Matchbox bribes per gauge. Sorted by MUSD per 1k veMEZO
          — the same ratio the Set &amp; Forget keeper uses to pick the
          highest-yield gauge. Read-only; bribe posting is not in scope for
          MezoYield.
        </p>
      </header>
      <BribeTable />
    </div>
  );
}
