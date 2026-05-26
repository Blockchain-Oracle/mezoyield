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
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { SubNav } from "@/components/chrome/SubNav";
import { EARN_SUBNAV } from "@/components/Sidebar/sidebarConfig";

/**
 * Strategies grid — the wedge. 6 cards, browse & pick. Click "Activate"
 * → opens StrategyDetailModal, which drives the activate hook through
 * delegate (Set & Forget) or setManualAllocation (static strategies).
 */
export default function StrategiesPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <PageSkeleton variant="grid" />;
  }
  return <StrategiesPageInner />;
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
      <PageHeader
        eyebrow="Earn"
        title="Pick a yield strategy"
        description="Browse 6 preset allocations across the live Mezo gauges. Activate one → MezoYield writes your vote on the optimizer. Non-custodial — your veMEZO never leaves your wallet. Re-activate any time to switch."
      />
      <SubNav items={EARN_SUBNAV} />

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
