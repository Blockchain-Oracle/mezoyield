"use client";

import { formatUnits } from "viem";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
import { useSortableRows, type SortDir } from "@/hooks/useSortableRows";
import { MEZO_EXPLORER } from "@/lib/contracts";
import { formatAddressLong } from "@/lib/format";
import { deriveGaugeDisplay } from "@/lib/gaugeMetadata";
import { TokenPair } from "./TokenPair";
import { cn } from "@/lib/utils";
import type { Gauge } from "@/lib/types";

type SortableGaugeKey = "name" | "totalVeMezoWei" | "bribeMUSDWei" | "apyPercent";

/**
 * Full-page gauge directory — source of truth for "what gauges exist
 * on Mezo right now and what's their APY". Numbers come from
 * useGaugeData (subgraph → on-chain RPC fallback). No synthesized rows.
 *
 * Row identity: pair-token glyphs + name + pool-type subtitle (derived
 * from the gauge name via deriveGaugeDisplay). Address moved to a small
 * mono link under the row's CTA cell, freeing the leftmost cell for
 * scannable identity.
 *
 * Sort: useSortableRows over name / totalVeMezoWei / bribeMUSDWei /
 * apyPercent. Default = APY descending. Column headers are buttons with
 * aria-sort on the parent <TableHead>.
 */
export function GaugeTable() {
  const { gauges, isLoading, isError, error, source } = useGaugeData();
  const rows = gauges ?? [];
  const { sorted, sortKey, sortDir, toggle } = useSortableRows<Gauge>(
    rows,
    "apyPercent",
    "desc",
  );

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

  if (sorted.length === 0) {
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
              <SortHeader
                label="Gauge"
                colKey="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggle}
              />
              <SortHeader
                label="Total veMEZO"
                colKey="totalVeMezoWei"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggle}
                align="right"
              />
              <SortHeader
                label="Bribe (MUSD/wk)"
                colKey="bribeMUSDWei"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggle}
                align="right"
              />
              <SortHeader
                label="APY"
                colKey="apyPercent"
                sortKey={sortKey}
                sortDir={sortDir}
                onToggle={toggle}
                align="right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((g) => {
              const display = deriveGaugeDisplay(g.name);
              return (
                <TableRow key={g.address}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <TokenPair tokens={display.tokens} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-foreground">{g.name}</span>
                        <a
                          href={`${MEZO_EXPLORER}/address/${g.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-mezo"
                        >
                          {display.poolType} ·{" "}
                          <span className="font-mono">
                            {formatAddressLong(g.address)}
                          </span>
                        </a>
                      </div>
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
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface SortHeaderProps {
  label: string;
  colKey: SortableGaugeKey;
  sortKey: keyof Gauge;
  sortDir: SortDir;
  onToggle: (key: keyof Gauge) => void;
  align?: "left" | "right";
}

function SortHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onToggle,
  align = "left",
}: SortHeaderProps) {
  const active = sortKey === colKey;
  const ariaSort = active
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead
      aria-sort={ariaSort}
      className={cn(align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onToggle(colKey)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide transition-colors",
          align === "right" && "justify-end ml-auto",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <Icon
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active ? "text-mezo" : "text-muted-foreground/60",
          )}
        />
      </button>
    </TableHead>
  );
}

function formatBigNumber(wei: bigint): string {
  const value = Number(formatUnits(wei, 18));
  if (value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(2);
}
