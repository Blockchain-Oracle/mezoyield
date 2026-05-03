"use client";

import { formatUnits } from "viem";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { useYieldHistory, type YieldBucket } from "@/hooks/useYieldHistory";

/**
 * 8-week MUSD claim history bar chart for /app/vault.
 *
 * Re-implementation of the V1 YieldChart against the same
 * `useYieldHistory` hook (which already does the contiguous
 * zero-fill + dormant-anchor logic from STORY-009 round 3).
 * Mezo accent on the bars, dark grid, dark tooltip surface.
 */
export function YieldChartCard() {
  const { epochs, isLoading, isError, error } = useYieldHistory();

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardContent>
          <div className="space-y-3">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-48 w-full animate-pulse rounded bg-muted" />
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
            Couldn&rsquo;t load yield history: {error?.message ?? "unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (epochs.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent>
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Yield history
            </span>
            <p className="text-sm text-muted-foreground">
              No yield history yet — claim your first epoch and check back.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const newestEpoch = epochs[epochs.length - 1].epoch;
  const data = epochs.map((b) => toRow(b, newestEpoch));

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Yield history
          </span>
          <span className="text-xs text-muted-foreground">
            last {epochs.length} epoch{epochs.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                stroke="#2A2A2A"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip
                cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
                contentStyle={{
                  backgroundColor: "#0d0d0d",
                  border: "1px solid #2a2a2a",
                  fontSize: 12,
                }}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return [`${n.toFixed(2)} MUSD`, "Earned"];
                }}
              />
              <Bar dataKey="musd" fill="#FF004D" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function toRow(bucket: YieldBucket, newestEpoch: number) {
  const delta = bucket.epoch - newestEpoch;
  const label = delta === 0 ? "Now" : `${delta}`;
  return {
    label,
    musd: Number(formatUnits(bucket.musdWei, 18)),
  };
}
