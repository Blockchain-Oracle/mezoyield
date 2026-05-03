"use client";

import { useAccount } from "wagmi";
import { ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useGaugeData } from "@/hooks/useGaugeData";
import { TOTAL_BPS } from "@/lib/optimize";

/**
 * Per-gauge breakdown of the user's current allocation. Reads
 * `MezoYieldOptimizer.getAllocation(user)` via `useVeMezoPosition`,
 * resolves gauge addresses to human names via `useGaugeData`.
 *
 * Empty state: "No allocation pinned" with a hint to pick a strategy.
 */
export function ActiveStrategyCard() {
  const { address, isConnected } = useAccount();
  const position = useVeMezoPosition(address);
  const gaugeData = useGaugeData();
  const gauges = gaugeData.gauges ?? [];

  const allocation = position.allocation;

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mezo-soft">
            <ListChecks aria-hidden className="h-5 w-5 text-mezo" />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Active allocation
              </span>
              <p className="text-sm text-muted-foreground">
                {!isConnected
                  ? "Connect a wallet to see your active allocation."
                  : allocation.length === 0
                    ? "No allocation pinned. Activate a strategy to start voting."
                    : "Read live from the optimizer's setManualAllocation."}
              </p>
            </div>

            {allocation.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
                {allocation.map((entry) => {
                  const g = gauges.find((x) => x.address === entry.gauge);
                  const pct = (entry.weightBps / TOTAL_BPS) * 100;
                  return (
                    <div key={entry.gauge} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {g?.name ??
                            `${entry.gauge.slice(0, 6)}…${entry.gauge.slice(-4)}`}
                        </span>
                        <span className="font-mono text-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-card">
                        <div
                          aria-hidden
                          className="h-full rounded-full bg-mezo"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
