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
import { useWalletReady } from "@/app/providers";
import { useYieldHistory, type YieldBucket } from "@/hooks/useYieldHistory";

/**
 * Last-8-epochs MUSD claim history. Reads from `useYieldHistory`,
 * which sources RewardsClaimed event logs from the optimizer (subgraph
 * fallback to come — see STORY-009 spec). Aunt-Linda framing per
 * CLAUDE.md: epoch labels are relative ("Epoch 0" = most recent), MUSD
 * values are formatted in plain decimal, never raw wei.
 *
 * Empty/loading/error states are first-class — never invented bars
 * (§14 grep gate, hot-path guarantee).
 */
export function YieldChart() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    // Match other dashboard cards: render the skeleton during SSR /
    // first client paint to avoid the WagmiProvider-not-mounted error
    // (same gate as PositionCard, OptimizeModal).
    return (
      <div
        data-testid="yield-chart-skeleton"
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }
  return <YieldChartInner />;
}

function YieldChartInner() {
  const { epochs, isLoading, isError, error } = useYieldHistory();

  if (isLoading) {
    return (
      <div
        data-testid="yield-chart-skeleton"
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="yield-chart-error"
        className="rounded-lg border border-border bg-card p-6 text-sm text-destructive"
      >
        Couldn&rsquo;t load yield history: {error?.message ?? "unknown error"}
      </div>
    );
  }

  if (epochs.length === 0) {
    return (
      <div
        data-testid="yield-chart-empty"
        className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground"
      >
        No yield history yet — claim your first epoch and check back.
      </div>
    );
  }

  // Convert wei → human MUSD. Recharts expects plain numbers on Y, so
  // we lose precision below 1e-12 MUSD which is fine for chart rendering
  // (the underlying bigint stays in the data tuple if a tooltip needs it).
  const newestEpoch = epochs[epochs.length - 1].epoch;
  const data = epochs.map((b) => toRow(b, newestEpoch));

  return (
    <div
      data-testid="yield-chart"
      className="rounded-lg border border-border bg-card p-6"
    >
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Yield history
        </div>
        <div
          data-testid="yield-chart-summary"
          className="text-xs text-muted-foreground"
        >
          {epochs.length} {epochs.length === 1 ? "epoch" : "epochs"}
        </div>
      </div>
      <div className="mt-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" vertical={false} />
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
              cursor={{ fill: "#1A1A1A" }}
              contentStyle={{
                backgroundColor: "#0D0D0D",
                border: "1px solid #2A2A2A",
                fontSize: 12,
              }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value);
                return [`${n.toFixed(2)} MUSD`, "Earned"];
              }}
            />
            <Bar dataKey="musd" fill="#F7931A" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function toRow(bucket: YieldBucket, newestEpoch: number) {
  const delta = bucket.epoch - newestEpoch; // 0, -1, -2, …
  const label = delta === 0 ? "Epoch 0" : `Epoch ${delta}`;
  return {
    label,
    musd: Number(formatUnits(bucket.musdWei, 18)),
  };
}
