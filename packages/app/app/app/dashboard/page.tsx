"use client";

import { useAccount } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { PositionSummary } from "@/features/dashboard/PositionSummary";
import { RealChainPositionCard } from "@/features/dashboard/RealChainPositionCard";
import { EpochStatsCard } from "@/features/dashboard/EpochStatsCard";
import { NextActionCard } from "@/features/dashboard/NextActionCard";
import { PendingClaimCard } from "@/features/dashboard/PendingClaimCard";
import { ExampleUserRow } from "@/features/dashboard/ExampleUserRow";

export default function DashboardPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <PageSkeleton variant="dashboard" />;
  }
  return <DashboardInner />;
}

function DashboardInner() {
  const { isConnected } = useAccount();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Your MEZO yield, at a glance"
        description="Live position, weekly reward projection, and one-click claim. Pick a strategy on the Strategies tab to put the system on autopilot."
      />

      {/* Right-rail epoch stats panel sits at xl+; on lg and below the
       *  card stacks under the main column so the sidebar's 270px doesn't
       *  squeeze the hero numbers. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 min-w-0">
          {!isConnected && <ExampleUserRow />}
          <PositionSummary />
          <RealChainPositionCard />
          <NextActionCard />
          <PendingClaimCard />
        </div>
        <EpochStatsCard />
      </div>
    </div>
  );
}
