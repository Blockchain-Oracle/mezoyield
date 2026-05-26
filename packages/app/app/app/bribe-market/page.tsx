"use client";

import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { BribeTable } from "@/features/bribe-market/BribeTable";

export default function BribeMarketPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return (
      <PageSkeleton>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </PageSkeleton>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bribe Market"
        title={"What’s being bribed this epoch"}
        description={
          <>
            Live read of Matchbox bribes per gauge. Sorted by MUSD per 1k veMEZO
            — the same ratio the Set &amp; Forget keeper uses to pick the
            highest-yield gauge. Read-only; bribe posting is not in scope for
            MezoYield.
          </>
        }
      />
      <BribeTable />
    </div>
  );
}
