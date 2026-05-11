"use client";

import { useWalletReady } from "@/app/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { GaugeTable } from "@/features/gauges/GaugeTable";

export default function GaugesPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Gauges
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Live Mezo gauge directory
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every gauge currently registered on the Mezo gauge controller, with
          its total veMEZO weight, posted bribe, and computed APY. Pick one on
          the Strategies tab — or use Custom to build your own allocation.
        </p>
      </header>
      <GaugeTable />
    </div>
  );
}
