"use client";

import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useUserAllocation } from "@/hooks/useUserAllocation";
import { useWalletReady } from "@/app/providers";
import { GaugeBoardSkeleton } from "./GaugeBoardSkeleton";
import type { Gauge } from "@/lib/types";

const NO_WEIGHT = "—";

function formatMUSDPerWeek(bribeWei: bigint): string {
  const value = Number(formatUnits(bribeWei, 18));
  if (value === 0) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

function formatPercent(weightBps: number): string {
  return `${(weightBps / 100).toFixed(0)}%`;
}

function formatApy(apy: number | null): string {
  if (apy === null) return "—";
  return `${apy.toFixed(1)}%`;
}

function findUserWeight(
  gauge: Gauge,
  entries: readonly { gauge: string; weightBps: number }[],
): number | null {
  const e = entries.find((x) => x.gauge.toLowerCase() === gauge.address.toLowerCase());
  return e?.weightBps ?? null;
}

/**
 * Outer wrapper: shows the skeleton until the wallet/wagmi provider stack
 * is mounted. This is the same gate-on-`useWalletReady` pattern as
 * ConnectButton (STORY-002 Codex P1) — wagmi hooks throw if called
 * outside `WagmiProvider`, so we must defer rendering the inner
 * (hook-calling) component until ready.
 */
export function GaugeBoard() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <GaugeBoardSkeleton />;
  }
  return <GaugeBoardInner />;
}

/**
 * Inner: only mounts when wagmi context is live. Renders the loading /
 * error / empty / populated states from story-005 BDD.
 */
function GaugeBoardInner() {
  const { address } = useAccount();
  const gaugeData = useGaugeData();
  const userAllocation = useUserAllocation(address);

  if (gaugeData.isLoading) {
    return <GaugeBoardSkeleton />;
  }

  if (gaugeData.isError) {
    return (
      <div
        data-testid="gauge-board-error"
        className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm"
      >
        <div className="font-medium text-destructive">Could not load gauge data</div>
        <div className="mt-1 text-muted-foreground">
          {gaugeData.error?.message ?? "Subgraph + RPC both unreachable. Try again in a moment."}
        </div>
        <button
          type="button"
          onClick={() => gaugeData.refetch()}
          className="mt-3 inline-flex items-center rounded-md border border-border px-3 py-1 text-xs hover:bg-muted/50"
          data-testid="gauge-board-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  const gauges = gaugeData.gauges ?? [];
  if (gauges.length === 0) {
    return (
      <div
        data-testid="gauge-board-empty"
        className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground"
      >
        No active gauges this epoch.
      </div>
    );
  }

  return (
    <div
      data-testid="gauge-board"
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-3 font-medium">Gauge</th>
            <th className="px-4 py-3 font-medium text-right">APY</th>
            <th className="px-4 py-3 font-medium text-right">Incentive (MUSD/wk)</th>
            <th className="px-4 py-3 font-medium text-right">My weight</th>
          </tr>
        </thead>
        <tbody>
          {gauges.map((g) => {
            const userWeight = userAllocation.isConnected
              ? findUserWeight(g, userAllocation.entries)
              : null;
            return (
              <tr
                key={g.address}
                data-testid={`gauge-row-${g.address}`}
                className="border-b border-border last:border-0 hover:bg-muted/20"
              >
                <td className="px-4 py-3 font-medium">{g.name}</td>
                <td className="px-4 py-3 text-right font-mono">{formatApy(g.apyPercent)}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatMUSDPerWeek(g.bribeMUSDWei)}
                </td>
                <td
                  className="px-4 py-3 text-right font-mono"
                  data-testid={`gauge-row-${g.address}-myweight`}
                >
                  {userAllocation.isConnected
                    ? userWeight !== null
                      ? formatPercent(userWeight)
                      : NO_WEIGHT
                    : NO_WEIGHT}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {gaugeData.source && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Source: {gaugeData.source === "subgraph" ? "Goldsky subgraph" : "On-chain RPC"}
        </div>
      )}
    </div>
  );
}
