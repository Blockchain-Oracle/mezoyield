"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import {
  GAUGE_CONTROLLER_ADDRESS,
  MATCHBOX_ADDRESS,
} from "@/lib/contracts";
import { gaugeControllerAbi, matchboxAbi } from "@/lib/abi";
import { computeApy, fetchGaugesFromSubgraph } from "@/lib/subgraph";
import type { Gauge, Address } from "@/lib/types";

type Source = "subgraph" | "rpc";

export type UseGaugeDataResult = {
  gauges: Gauge[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  source: Source | null;
  refetch: () => void;
};

/**
 * Source the gauge board's table.
 *
 * Strategy (per story-005):
 *   A. Try the Goldsky subgraph (sponsor integration). Returns null
 *      from the client when no endpoint is configured — that's a
 *      "fall through" signal, not an error.
 *   B. Whenever the subgraph isn't currently delivering data (no
 *      endpoint, transient error, or first-load not yet returned),
 *      run the RPC fallback: read `MockGaugeController.gauges()` for
 *      the address list, then batch-read `gaugeMeta(addr)` and
 *      `MockMatchbox.bribeForGauge(addr)` per gauge. Compose into
 *      `Gauge[]` with APY computed via the spec's
 *      `(bribe / totalVeMezo) * 52`.
 *   C. Surface a terminal error only when the active path actually
 *      failed — a subgraph-only error MUST NOT mask a successful RPC
 *      fallback (Codex P1 fix on PR #22). If RPC also fails (or RPC
 *      isn't reachable because subgraph is the only configured leg),
 *      surface that error with a Retry button in the UI.
 *
 * §14: never synthesizes or caches gauge rows. If both legs fail,
 * the hook returns isError; never invented data.
 */
export function useGaugeData(): UseGaugeDataResult {
  // -- Path A: subgraph --
  const subgraphQuery = useQuery({
    queryKey: ["gauges", "subgraph"],
    queryFn: fetchGaugesFromSubgraph,
    retry: false,
    staleTime: 30_000,
  });

  const subgraphHasData = subgraphQuery.data != null;
  const subgraphFailedOrUnconfigured =
    !subgraphQuery.isLoading &&
    (subgraphQuery.data === null || subgraphQuery.error != null);

  // -- Path B: RPC fallback --
  // Engaged whenever the subgraph isn't currently the source of truth:
  // unconfigured (data === null), errored, or hasn't returned yet on first
  // load. Disabled only if the subgraph is actively loading its first
  // request — avoids two simultaneous requests on cold mount.
  const rpcEnabled =
    !subgraphHasData && !subgraphQuery.isLoading;

  const listQuery = useReadContracts({
    contracts: [
      {
        address: GAUGE_CONTROLLER_ADDRESS,
        abi: gaugeControllerAbi,
        functionName: "gauges",
      },
    ],
    query: {
      enabled: rpcEnabled,
      staleTime: 30_000,
    },
  });

  const gaugeAddresses =
    (listQuery.data?.[0]?.result as readonly Address[] | undefined) ?? undefined;

  const metaQuery = useReadContracts({
    contracts:
      gaugeAddresses?.flatMap((g) => [
        {
          address: GAUGE_CONTROLLER_ADDRESS,
          abi: gaugeControllerAbi,
          functionName: "gaugeMeta",
          args: [g],
        } as const,
        {
          address: MATCHBOX_ADDRESS,
          abi: matchboxAbi,
          functionName: "bribeForGauge",
          args: [g],
        } as const,
      ]) ?? [],
    query: {
      enabled: !!gaugeAddresses && gaugeAddresses.length > 0,
      staleTime: 30_000,
    },
  });

  const refetchAll = () => {
    void subgraphQuery.refetch();
    if (rpcEnabled) {
      void listQuery.refetch();
      void metaQuery.refetch();
    }
  };

  // -- Compose --

  // A. Subgraph success: preferred outcome.
  if (subgraphHasData && subgraphQuery.data) {
    return {
      gauges: subgraphQuery.data,
      isLoading: false,
      isError: false,
      error: null,
      source: "subgraph",
      refetch: refetchAll,
    };
  }

  // B. RPC fallback success — even if subgraph errored. This is the
  // canonical "RPC fallback" of the spec; we don't shadow it with a
  // subgraph-only error.
  const rpcReady =
    !!gaugeAddresses &&
    (gaugeAddresses.length === 0 ||
      (!!metaQuery.data && !metaQuery.isLoading));

  if (rpcEnabled && rpcReady && !listQuery.error && !metaQuery.error) {
    const gauges: Gauge[] = (gaugeAddresses ?? []).map((address, i) => {
      const metaResult = metaQuery.data?.[i * 2]?.result as
        | readonly [string, bigint]
        | undefined;
      const bribeResult = metaQuery.data?.[i * 2 + 1]?.result as bigint | undefined;
      const name = metaResult?.[0] ?? "Unknown";
      const totalVeMezoWei = metaResult?.[1] ?? 0n;
      const bribeMUSDWei = bribeResult ?? 0n;
      return {
        address,
        name,
        totalVeMezoWei,
        bribeMUSDWei,
        apyPercent: computeApy(bribeMUSDWei, totalVeMezoWei),
      };
    });
    return {
      gauges,
      isLoading: false,
      isError: false,
      error: null,
      source: "rpc",
      refetch: refetchAll,
    };
  }

  // C. Terminal error — only when the active path actually failed. RPC
  // error wins when RPC was attempted (we know it failed); otherwise the
  // subgraph error surfaces only if RPC isn't engaged at all (defensive —
  // unreachable in the default config because rpcEnabled is true whenever
  // subgraph isn't actively loading or delivering).
  const rpcError =
    (listQuery.error as Error | null) ?? (metaQuery.error as Error | null) ?? null;
  if (rpcEnabled && rpcError) {
    return {
      gauges: undefined,
      isLoading: false,
      isError: true,
      error: rpcError,
      source: null,
      refetch: refetchAll,
    };
  }
  if (!rpcEnabled && (subgraphQuery.error as Error | null)) {
    return {
      gauges: undefined,
      isLoading: false,
      isError: true,
      error: subgraphQuery.error as Error,
      source: null,
      refetch: refetchAll,
    };
  }

  // Otherwise: still loading.
  const isLoading =
    subgraphQuery.isLoading ||
    listQuery.isLoading ||
    (!!gaugeAddresses && gaugeAddresses.length > 0 && metaQuery.isLoading);
  return {
    gauges: undefined,
    isLoading,
    isError: false,
    error: null,
    source: null,
    refetch: refetchAll,
  };
}
