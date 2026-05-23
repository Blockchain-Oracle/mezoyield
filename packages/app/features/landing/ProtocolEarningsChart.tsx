"use client";

import { formatUnits } from "viem";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWalletReady } from "@/app/providers";
import { useProtocolBribesHistory } from "@/hooks/useProtocolBribesHistory";
import { useGaugeData } from "@/hooks/useGaugeData";
import type { Address } from "@/lib/types";

/**
 * Landing-page chart of MUSD bribed into each Mezo gauge. Anchor signal
 * lifted from Boar Finance's "Live Performance" panel — before a
 * visitor connects, they see the protocol is actually moving.
 *
 * Why per-gauge (not weekly time-series): all current bribes were posted
 * in the same epoch during the mainnet seeding, so a weekly chart
 * collapses to one tall bar + seven empty bars and misleads readers
 * into thinking the protocol just spiked. Per-gauge distribution is
 * the actually-useful signal: it shows *where* sponsor MUSD is sitting,
 * which is what an Aunt-Linda user wants to know ("which pools are
 * paying right now?"). When bribes start landing across multiple
 * epochs, the hook already exposes `epochs[]` — we can add a tab
 * toggle then.
 *
 * Why bribes (not RewardsClaimed): claims fire only after a user calls
 * `claim()` post-settlement, and no user has done that yet on either
 * network — the prior chart sat flat at 0/0/0. Bribes are the
 * upstream signal: MUSD landing in the protocol that will *become*
 * claims. §14 still holds — every bar is an on-chain log.
 *
 * Currency: MUSD only. There is no live price feed wired up, so we
 * don't render BTC values. Codex P1 (pre-merge review) caught a prior
 * version using a fixed sentinel rate to fake a BTC toggle — invented
 * numbers on a credibility chart break the same anti-slop rule we
 * apply to gauges and APYs.
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
  const { byGauge, uniqueGauges, source, isError, error } =
    useProtocolBribesHistory();
  const { gauges: knownGauges } = useGaugeData();

  if (isError) {
    return (
      <section className="mx-auto w-full max-w-5xl px-6">
        <div className="rounded-2xl border border-border bg-card/40 p-6">
          <p className="text-sm text-destructive">
            Couldn&rsquo;t load protocol bribes: {error?.message ?? "unknown error"}
          </p>
        </div>
      </section>
    );
  }

  const total = byGauge.reduce((acc, b) => acc + b.amountWei, 0n);
  const isEmpty = byGauge.length === 0 || total === 0n;
  const rows = (isEmpty ? buildEmptyRows() : byGauge).map((b, i) =>
    toRow(b, total, knownGauges ?? [], i),
  );

  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <div
        data-testid="protocol-chart"
        className="rounded-2xl border border-border bg-card/40 p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              MUSD bribed into the protocol
            </span>
            <span
              data-testid="protocol-chart-currency-label"
              className="font-display text-2xl font-medium tracking-tight text-foreground"
            >
              {formatTotal(total)}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {uniqueGauges} {uniqueGauges === 1 ? "gauge" : "gauges"} ·
              latest BribeUpdated per gauge · source {source ?? "rpc"}
            </span>
          </div>
        </div>

        <div className="mt-5 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={isEmpty ? [0, 1] : undefined}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
                }
              />
              <YAxis
                type="category"
                dataKey="label"
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  backgroundColor: "var(--color-background)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)",
                  fontSize: 11,
                }}
                formatter={(value, _name, ctx) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const pct = ctx?.payload?.pct;
                  return [
                    `${n.toFixed(2)} MUSD${typeof pct === "number" ? ` · ${pct.toFixed(1)}%` : ""}`,
                    "Bribed",
                  ];
                }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {rows.map((r) => (
                  <Cell key={r.label} fill={r.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {isEmpty && (
          <p className="mt-2 text-xs text-muted-foreground">
            No bribes posted yet — once a sponsor calls the matchbox the
            chart fills in via on-chain
            <code className="mx-1 font-mono text-foreground">BribeUpdated</code>
            events.
          </p>
        )}
      </div>
    </section>
  );
}

type RawRow = { gauge: Address; amountWei: bigint };
type ChartRow = {
  label: string;
  value: number;
  pct: number;
  fill: string;
};

function buildEmptyRows(): RawRow[] {
  // Five placeholder rows so the bar chart container retains its
  // canonical height instead of collapsing. Zero values are explicit,
  // never invented (§14).
  const zero = "0x0000000000000000000000000000000000000000" as Address;
  return Array.from({ length: 5 }, () => ({ gauge: zero, amountWei: 0n }));
}

function toRow(
  bucket: RawRow,
  total: bigint,
  known: Array<{ address: Address; name: string }>,
  index: number,
): ChartRow {
  const meta = known.find(
    (g) => g.address.toLowerCase() === bucket.gauge.toLowerCase(),
  );
  const label =
    meta?.name ??
    (bucket.gauge === "0x0000000000000000000000000000000000000000"
      ? `Gauge ${index + 1}`
      : `${bucket.gauge.slice(0, 6)}…${bucket.gauge.slice(-4)}`);
  const value = Number(formatUnits(bucket.amountWei, 18));
  const pct =
    total === 0n
      ? 0
      : Number((bucket.amountWei * 10_000n) / total) / 100;
  // Top-bribed gauge gets the brand accent; the rest sit at half opacity
  // so the eye lands on the leader. Pure visual, no data implication.
  const fill = index === 0 ? "var(--color-mezo)" : "rgba(255,0,77,0.45)";
  return { label, value, pct, fill };
}

function formatTotal(wei: bigint): string {
  return `${Number(formatUnits(wei, 18)).toFixed(2)} MUSD`;
}
