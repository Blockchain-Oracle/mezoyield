"use client";

import { useWalletReady } from "@/app/providers";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PageSkeleton } from "@/components/chrome/PageSkeleton";
import { GaugeTable } from "@/features/gauges/GaugeTable";

export default function GaugesPage() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <PageSkeleton variant="table" />;
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gauges"
        title="Live Mezo gauge directory"
        description="Every gauge currently registered on the Mezo gauge controller, with its total veMEZO weight, posted bribe, and computed APY. Pick one on the Strategies tab — or use Custom to build your own allocation."
      />
      <GaugeTable />
    </div>
  );
}
