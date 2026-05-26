"use client";

import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { SubNav } from "@/components/chrome/SubNav";
import { EARN_SUBNAV } from "@/components/Sidebar/sidebarConfig";
import { DelegationStatusCard } from "@/features/vault/DelegationStatusCard";
import { ActiveStrategyCard } from "@/features/vault/ActiveStrategyCard";
import { EarningsCard } from "@/features/vault/EarningsCard";
import { YieldChartCard } from "@/features/vault/YieldChartCard";
import { SimulatorPanel } from "@/features/simulator/SimulatorPanel";

/**
 * Vault — your delegation state, current allocation, lifetime
 * earnings, and 8-week yield history.
 */
export default function VaultPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return (
      <PageSkeleton>
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </PageSkeleton>
    );
  }
  return <VaultInner />;
}

function VaultInner() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Earn"
        title="Your delegation, allocation, and history"
        description={
          <>
            Everything you&rsquo;ve put on the optimizer — read live from on-chain
            state. Non-custodial: your veMEZO never moves.
          </>
        }
      />
      <SubNav items={EARN_SUBNAV} />

      <DelegationStatusCard />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <EarningsCard />
        <ActiveStrategyCard />
      </div>

      <YieldChartCard />

      <SimulatorPanel />
    </div>
  );
}
