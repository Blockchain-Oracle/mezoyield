"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { TrendingUp, FlaskConical, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useSimulation } from "./useSimulation";
import { cn } from "@/lib/utils";

/**
 * "What if?" panel — replays each strategy against the user's CURRENT
 * veMEZO balance over an 8-week horizon (assuming gauge state is
 * stable, since historical bribe snapshots aren't available without a
 * subgraph). Shows projected total + weekly MUSD per strategy, sorted
 * descending so the winner is on top.
 *
 * Empty states:
 *   - Disconnected: prompt to connect.
 *   - Connected, 0 veMEZO: prompt to acquire veMEZO before simulating.
 *   - Connected, no gauges loaded: skeleton until useGaugeData lands.
 */
export function SimulatorPanel() {
  const { address, isConnected } = useAccount();
  const position = useVeMezoPosition(address);
  const gaugeData = useGaugeData();
  const gauges = gaugeData.gauges ?? [];
  const { rows, weeks } = useSimulation(position.balanceWei, gauges);

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mezo-soft">
            <FlaskConical aria-hidden className="h-5 w-5 text-mezo" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                What-if simulator · {weeks}-week horizon
              </span>
              <p className="text-sm text-muted-foreground">
                Projected MUSD earned per strategy against your current
                veMEZO balance, holding live gauge state stable. Compare
                before you switch.
              </p>
            </div>

            {!isConnected && (
              <p className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Connect a wallet to run the simulator against your veMEZO.
              </p>
            )}

            {isConnected && position.balanceWei === 0n && (
              <p className="rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
                Your wallet holds 0 veMEZO. Acquire veMEZO first — then this
                panel will preview each strategy&rsquo;s payout.
              </p>
            )}

            {isConnected && position.balanceWei > 0n && rows.length === 0 && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {rows.length > 0 && (
              <div className="space-y-2">
                {rows.map((row, i) => {
                  const weekly = Number(formatUnits(row.weeklyWei, 18));
                  const total = Number(formatUnits(row.totalWei, 18));
                  const isWinner = i === 0;
                  return (
                    <div
                      key={row.preset.id}
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-lg border bg-background/40 p-3 transition-colors",
                        isWinner
                          ? "border-mezo/40 bg-mezo-soft"
                          : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isWinner ? (
                          <Sparkles
                            aria-hidden
                            className="h-4 w-4 shrink-0 text-mezo"
                          />
                        ) : (
                          <TrendingUp
                            aria-hidden
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                          />
                        )}
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isWinner ? "text-mezo" : "text-foreground",
                            )}
                          >
                            {row.preset.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {row.preset.tagline}
                          </span>
                        </div>
                        {isWinner && (
                          <Badge className="bg-mezo text-primary-foreground">
                            Best
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {total.toFixed(2)} MUSD
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          ≈ {weekly.toFixed(2)} / wk
                        </span>
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Forward-looking proxy — assumes current gauge bribe state
                  holds for the next {weeks} weeks. Real returns will vary
                  as gauges&rsquo; bribes shift epoch-to-epoch.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
