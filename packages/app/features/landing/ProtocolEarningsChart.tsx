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
import {
  useProtocolYieldHistory,
} from "@/hooks/useProtocolYieldHistory";
import type { YieldBucket } from "@/hooks/useYieldHistory";

/**
 * Synthesize 8 zero-value contiguous buckets ending at the current
 * Unix-aligned epoch. ONLY used to keep the chart container visible
 * when `epochs.length === 0` from the hook (genuinely no on-chain
 * claims yet) — per SPEC.md acceptance: "Chart renders with all-zero
 * bars and a small empty-state line — never invented values." The
 * values are explicitly zero, not invented. The visible "No claims
 * yet" line accompanies the bars so readers don't mistake a flat
 * baseline for a price chart.
 */
function buildEmptyBuckets(): YieldBucket[] {
  const SECONDS_PER_EPOCH = 604_800;
  const nowEpoch = Math.floor(Date.now() / 1000 / SECONDS_PER_EPOCH);
  return Array.from({ length: 8 }, (_, i) => ({
    epoch: nowEpoch - (7 - i),
    musdWei: 0n,
  }));
}

/**
 * Landing-page chart of protocol-aggregate MUSD distributed per epoch.
 * Anchor signal lifted from Boar Finance's "Live Performance" panel —
 * before a visitor connects, they see the protocol is actually moving.
 *
 * Sized smaller than Boar's hero chart on purpose — the strategies grid
 * remains MezoYield's hero, the chart is secondary credibility.
 *
 * Currency: MUSD only. Rewards are MUSD-denominated on-chain; there is
 * no live price feed wired up, so we don't render BTC values. Codex P1
 * (pre-merge review) caught a prior version using a fixed sentinel rate
 * to fake a BTC toggle — invented numbers on a credibility chart break
 * the same anti-slop rule we apply to gauges and APYs.
 *
 * §14: no invented values. Hook returns `[]` → empty-state copy. Hook
 * returns isError → error block, never a blank chart.
 */

export function ProtocolEarningsChart() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <ProtocolEarningsChartSkeleton />;
  }
  return <ProtocolEarningsChartInner />;
}

function ProtocolEarningsChartSkeleton() {
  return (
    <section
      data-testid="protocol-chart-skeleton"
      className="mx-auto w-full max-w-5xl px-6"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40 p-6">
        <div className="flex items-baseline justify-between">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-6 h-40 w-full animate-pulse rounded bg-muted" />
      </div>
    </section>
  );
}

function ProtocolEarningsChartInner() {
  const { epochs, uniqueClaimants, source, isError, error } =
    useProtocolYieldHistory();

  if (isError) {
    return (
      <section className="mx-auto w-full max-w-5xl px-6">
        <div className="rounded-2xl border border-border bg-card/40 p-6">
          <p className="text-sm text-destructive">
            Couldn&rsquo;t load protocol earnings: {error?.message ?? "unknown error"}
          </p>
        </div>
      </section>
    );
  }

  const total = epochs.reduce((acc, b) => acc + b.musdWei, 0n);
  const isEmpty = epochs.length === 0 || total === 0n;
  const displayBuckets = epochs.length === 0 ? buildEmptyBuckets() : epochs;
  const newestEpoch = displayBuckets[displayBuckets.length - 1].epoch;
  const data = displayBuckets.map((b) => toRow(b, newestEpoch));

  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <div
        data-testid="protocol-chart"
        className="rounded-2xl border border-border bg-card/40 p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Protocol earnings
            </span>
            <span
              data-testid="protocol-chart-currency-label"
              className="font-display text-2xl font-medium tracking-tight text-foreground"
            >
              {formatTotal(total)}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              across {uniqueClaimants} unique{" "}
              {uniqueClaimants === 1 ? "claimant" : "claimants"} ·{" "}
              {epochs.length} epochs · source {source ?? "rpc"}
            </span>
          </div>
        </div>

        <div className="mt-5 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={isEmpty ? [0, 1] : undefined}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  backgroundColor: "var(--color-background)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)",
                  fontSize: 11,
                }}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return [`${n.toFixed(2)} MUSD`, "Distributed"];
                }}
              />
              <Bar dataKey="value" fill="var(--color-mezo)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {isEmpty && (
          <p className="mt-2 text-xs text-muted-foreground">
            No claims yet — be the first to optimize and post an on-chain
            <code className="mx-1 font-mono text-foreground">RewardsClaimed</code>
            event.
          </p>
        )}
      </div>
    </section>
  );
}

function toRow(bucket: YieldBucket, newestEpoch: number) {
  const delta = bucket.epoch - newestEpoch;
  const label = delta === 0 ? "Now" : `${delta}`;
  return {
    label,
    value: Number(formatUnits(bucket.musdWei, 18)),
  };
}

function formatTotal(wei: bigint): string {
  return `${Number(formatUnits(wei, 18)).toFixed(2)} MUSD`;
}
