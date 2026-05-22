"use client";

import { useAccount } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionSummary } from "@/features/dashboard/PositionSummary";
import { RealChainPositionCard } from "@/features/dashboard/RealChainPositionCard";
import { EpochCountdownStrip } from "@/features/dashboard/EpochCountdownStrip";
import { NextActionCard } from "@/features/dashboard/NextActionCard";
import { PendingClaimCard } from "@/features/dashboard/PendingClaimCard";
import { ExampleUserRow } from "@/features/dashboard/ExampleUserRow";

/**
 * Dashboard — at-a-glance view: hero metrics, epoch countdown, next
 * action prompt, claim row. The actual content is in features/dashboard/
 * components; this file is composition + the wallet-ready gate that
 * prevents wagmi hooks from firing before the lazy provider stack mounts.
 */
export default function DashboardPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <DashboardSkeleton />;
  }
  return <DashboardInner />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function DashboardInner() {
  const { isConnected } = useAccount();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Dashboard
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Your MEZO yield, at a glance
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live position, weekly reward projection, and one-click claim.
          Pick a strategy on the Strategies tab to put the system on
          autopilot.
        </p>
      </header>

      {!isConnected && <ExampleUserRow />}

      <PositionSummary />
      <RealChainPositionCard />
      <EpochCountdownStrip />
      <NextActionCard />
      <PendingClaimCard />
    </div>
  );
}
