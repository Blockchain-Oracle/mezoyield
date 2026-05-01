"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useWalletReady } from "@/app/providers";
import type { Gauge } from "@/lib/types";

function formatVeMezo(balanceWei: bigint): string {
  const value = Number(formatUnits(balanceWei, 18));
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  return value.toFixed(2);
}

/**
 * Compute the user's expected MUSD/week from their pinned allocation:
 *   For each (gauge, weightBps) entry, share = userVeMezo * weightBps / 10_000.
 *   That share's weekly reward = (share / gauge.totalVeMezo) * gauge.bribeMUSD.
 *   Sum across gauges. Returns wei (18 decimals).
 *
 * Returns 0n when allocation is empty or gauges aren't loaded.
 */
function estimateWeeklyMusdWei(
  userVeMezoWei: bigint,
  allocation: { gauge: string; weightBps: number }[],
  gauges: Gauge[],
): bigint {
  if (userVeMezoWei === 0n || allocation.length === 0 || gauges.length === 0) return 0n;
  let totalWei = 0n;
  for (const entry of allocation) {
    const g = gauges.find((x) => x.address.toLowerCase() === entry.gauge.toLowerCase());
    if (!g || g.totalVeMezoWei === 0n) continue;
    // share = userVeMezo * weightBps / 10_000
    const shareWei = (userVeMezoWei * BigInt(entry.weightBps)) / 10_000n;
    // reward = share * bribe / totalInGauge
    const rewardWei = (shareWei * g.bribeMUSDWei) / g.totalVeMezoWei;
    totalWei += rewardWei;
  }
  return totalWei;
}

export function PositionCard() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <PositionCardSkeleton />;
  }
  return <PositionCardInner />;
}

function PositionCardSkeleton() {
  return (
    <div
      data-testid="position-card-skeleton"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}

function PositionCardInner() {
  const { address } = useAccount();
  const position = useVeMezoPosition(address);
  const gaugeData = useGaugeData();

  if (!position.isConnected) {
    return (
      <div
        data-testid="position-card-disconnected"
        className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground"
      >
        Connect wallet to see your position
      </div>
    );
  }

  if (position.isLoading) {
    return <PositionCardSkeleton />;
  }

  const weeklyWei = estimateWeeklyMusdWei(
    position.balanceWei,
    position.allocation,
    gaugeData.gauges ?? [],
  );
  const weeklyDisplay = Number(formatUnits(weeklyWei, 18));

  return (
    <div
      data-testid="position-card"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Estimated yield
      </div>
      <div
        className="mt-1 font-mono text-3xl font-semibold text-foreground"
        data-testid="position-card-hero"
      >
        ≈ {weeklyDisplay.toFixed(2)} MUSD/week
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        from <span className="font-mono">{formatVeMezo(position.balanceWei)}</span> veMEZO
        {position.allocation.length > 0 && (
          <>
            {" "}
            ·{" "}
            <span data-testid="position-card-allocated">
              Allocated: {position.allocation.length}{" "}
              {position.allocation.length === 1 ? "gauge" : "gauges"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
