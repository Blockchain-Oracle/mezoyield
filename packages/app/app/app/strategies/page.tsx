"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { useGaugeData } from "@/hooks/useGaugeData";
import { StrategyCard } from "@/features/strategies/StrategyCard";
import { StrategyDetailModal } from "@/features/strategies/StrategyDetailModal";
import {
  STRATEGY_PRESETS,
  type StrategyPreset,
} from "@/features/strategies/presets";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Strategies grid — the wedge. 6 cards, browse & pick. Click "Activate"
 * → opens StrategyDetailModal, which drives the activate hook through
 * delegate (Set & Forget) or setManualAllocation (static strategies).
 */
export default function StrategiesPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <StrategiesSkeleton />;
  }
  return <StrategiesPageInner />;
}

function StrategiesSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-12 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    </div>
  );
}

function StrategiesPageInner() {
  const { address } = useAccount();
  const gaugeData = useGaugeData();
  const gauges = gaugeData.gauges ?? [];

  const [selected, setSelected] = useState<StrategyPreset | null>(null);
  const [open, setOpen] = useState(false);

  const handleActivate = (preset: StrategyPreset) => {
    setSelected(preset);
    setOpen(true);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Strategies
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Pick a yield strategy
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Browse 6 preset allocations across the live Mezo gauges. Activate
          one → MezoYield writes your vote on the optimizer. Non-custodial —
          your veMEZO never leaves your wallet. Re-activate any time to
          switch.
        </p>
      </header>

      {gaugeData.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STRATEGY_PRESETS.map((preset) => (
            <StrategyCard
              key={preset.id}
              preset={preset}
              gauges={gauges}
              onActivate={handleActivate}
            />
          ))}
        </div>
      )}

      <StrategyDetailModal
        preset={selected}
        user={address}
        gauges={gauges}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
