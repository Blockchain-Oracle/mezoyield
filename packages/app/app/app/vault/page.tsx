"use client";

import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
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
    return <VaultSkeleton />;
  }
  return <VaultInner />;
}

function VaultSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function VaultInner() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          My Vault
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Your delegation, allocation, and history
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Everything you&rsquo;ve put on the optimizer — read live from on-chain
          state. Non-custodial: your veMEZO never moves.
        </p>
      </header>

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
