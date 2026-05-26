"use client";

import { formatUnits } from "viem";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useGaugeData } from "@/hooks/useGaugeData";
import { MEZO_EXPLORER } from "@/lib/contracts";
import { formatAddressLong } from "@/lib/format";

/**
 * Full-page gauge directory — source of truth for "what gauges exist
 * on Mezo right now and what's their APY". Numbers come from
 * useGaugeData (subgraph → on-chain RPC fallback). No synthesized rows.
 */
export function GaugeTable() {
  const { gauges, isLoading, isError, error, source } = useGaugeData();

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
            Couldn&rsquo;t load gauges: {error?.message ?? "unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const rows = gauges ?? [];
  if (rows.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active gauges this epoch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-baseline justify-between pb-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Live gauges
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            source: {source ?? "—"}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gauge</TableHead>
              <TableHead className="text-right">Total veMEZO</TableHead>
              <TableHead className="text-right">Bribe (MUSD/wk)</TableHead>
              <TableHead className="text-right">APY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.address}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-foreground">{g.name}</span>
                    <a
                      href={`${MEZO_EXPLORER}/address/${g.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-muted-foreground hover:text-mezo"
                    >
                      {formatAddressLong(g.address)}
                    </a>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatBigNumber(g.totalVeMezoWei)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatBigNumber(g.bribeMUSDWei)}
                </TableCell>
                <TableCell className="text-right font-mono text-mezo">
                  {g.apyPercent != null ? `${g.apyPercent.toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function formatBigNumber(wei: bigint): string {
  const value = Number(formatUnits(wei, 18));
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(2);
}
