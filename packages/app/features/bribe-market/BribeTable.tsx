"use client";

import { formatUnits } from "viem";
import { Coins } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGaugeData } from "@/hooks/useGaugeData";

/**
 * Read-only Matchbox bribe board. Each row = one gauge with its
 * currently-posted MUSD bribe + the bribe-per-1k-veMEZO ratio (a
 * proxy for "how generous is this gauge per unit of vote weight"
 * — what the optimizer's autoAllocate algorithm sorts on).
 *
 * Sourced from useGaugeData (the same hook the Strategies + Gauges
 * pages use). No separate Matchbox call needed — the bribe figure
 * already lands in `gauge.bribeMUSDWei`.
 */
export function BribeTable() {
  const { gauges, isLoading, isError, error } = useGaugeData();

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-card">
        <CardContent>
          <p className="text-sm text-destructive">
            Couldn&rsquo;t load bribes: {error?.message ?? "unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = gauges ?? [];
  const sorted = [...rows].sort((a, b) => {
    const ra = ratio(a.bribeMUSDWei, a.totalVeMezoWei);
    const rb = ratio(b.bribeMUSDWei, b.totalVeMezoWei);
    return rb - ra;
  });
  const totalBribes = rows.reduce((acc, g) => acc + g.bribeMUSDWei, 0n);

  return (
    <div className="space-y-4">
      <Card className="bg-card">
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mezo-soft">
              <Coins aria-hidden className="h-5 w-5 text-mezo" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Total bribes posted this epoch
              </span>
              <span className="font-mono text-2xl font-semibold text-foreground">
                {formatBigNumber(totalBribes)} MUSD
              </span>
              <span className="text-xs text-muted-foreground">
                Across {rows.length} gauge{rows.length === 1 ? "" : "s"} —
                refreshes when bribers post fresh MUSD on Matchbox.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gauge</TableHead>
                <TableHead className="text-right">Bribe</TableHead>
                <TableHead className="text-right">Total veMEZO</TableHead>
                <TableHead className="text-right">MUSD per 1k veMEZO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((g) => {
                const r = ratio(g.bribeMUSDWei, g.totalVeMezoWei);
                return (
                  <TableRow key={g.address}>
                    <TableCell className="text-foreground">{g.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatBigNumber(g.bribeMUSDWei)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatBigNumber(g.totalVeMezoWei)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-mezo">
                      {r > 0 ? r.toFixed(4) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ratio(bribeWei: bigint, totalVeMezoWei: bigint): number {
  if (totalVeMezoWei === 0n) return 0;
  // (bribe / totalVeMezo) * 1000 — MUSD attracted per 1000 veMEZO of voting weight.
  // Compute in bigint to avoid precision loss on small bribes against huge pools.
  const SCALE = 10n ** 18n;
  const scaled = (bribeWei * SCALE * 1_000n) / totalVeMezoWei;
  return Number(scaled) / Number(SCALE);
}

function formatBigNumber(wei: bigint): string {
  const value = Number(formatUnits(wei, 18));
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(2);
}
