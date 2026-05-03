"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useGaugeData } from "@/hooks/useGaugeData";
import { estimateWeeklyMusdWei } from "@/lib/optimize";

/**
 * Hero card on /app/dashboard. Shows: veMEZO balance + projected
 * MUSD/wk against the user's actual current allocation. When the user
 * isn't connected or hasn't picked a strategy, the projected reward
 * collapses to "—" so we never invent a number (§14).
 */
export function PositionSummary() {
  const { address } = useAccount();
  const position = useVeMezoPosition(address);
  const gaugeData = useGaugeData();
  const gauges = gaugeData.gauges ?? [];

  const veMezoFormatted = formatVeMezo(position.balanceWei);
  const weeklyWei =
    position.allocation.length > 0
      ? estimateWeeklyMusdWei(
          position.balanceWei,
          position.allocation.map((a) => ({
            gauge: a.gauge,
            weightBps: a.weightBps,
          })),
          gauges,
        )
      : 0n;
  const weeklyMusd = Number(formatUnits(weeklyWei, 18));
  const hasAllocation = position.allocation.length > 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="bg-card">
        <CardContent>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Your veMEZO
            </span>
            <span className="font-display text-4xl font-medium tracking-tight text-foreground">
              {position.isConnected ? veMezoFormatted : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {position.isConnected
                ? "voting power"
                : "Connect a wallet to see your position"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Projected reward
            </span>
            <span className="font-display text-4xl font-medium tracking-tight text-mezo">
              {position.isConnected && hasAllocation
                ? `≈ ${weeklyMusd.toFixed(2)}`
                : "—"}
              <span className="ml-1 text-sm text-muted-foreground">
                MUSD/wk
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {position.isConnected
                ? hasAllocation
                  ? "based on your current allocation"
                  : "Pick a strategy to start earning"
                : "based on your current allocation"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatVeMezo(balanceWei: bigint): string {
  const value = Number(formatUnits(balanceWei, 18));
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  return value.toFixed(2);
}
