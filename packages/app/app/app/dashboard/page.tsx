"use client";

import { useAccount } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { PositionSummary } from "@/features/dashboard/PositionSummary";
import { RealChainPositionCard } from "@/features/dashboard/RealChainPositionCard";
import { EpochCountdownStrip } from "@/features/dashboard/EpochCountdownStrip";
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

      {!isConnected && <ExampleUserRow />}

      <PositionSummary />
      <RealChainPositionCard />
      <EpochCountdownStrip />
      <NextActionCard />
      <PendingClaimCard />
    </div>
  );
}
