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
 *   1. Try the Goldsky subgraph (sponsor integration). Returns null if no
 *      endpoint is configured (NEXT_PUBLIC_GOLDSKY_GAUGES_URL).
 *   2. Fall back to direct on-chain reads via wagmi `useReadContracts`:
 *      a. Read `MockGaugeController.gauges()` for the address list.
 *      b. Batch-read `gaugeMeta(addr)` and `MockMatchbox.bribeForGauge(addr)`
 *         per gauge.
 *      c. Compose into the `Gauge[]` shape with APY computed via
 *         `(bribe / totalVeMezo) * 52`.
 *
 * The hook surfaces `source` so callers can show provenance ("Goldsky"
 * vs "on-chain") in the UI if useful, and `isError` so GaugeBoard can
 * render the user-readable error state from the spec.
 *
 * §14: this hook never synthesizes or caches gauge data. If both paths
 * fail, the result is an explicit error state — never invented rows.
 */
export function useGaugeData(): UseGaugeDataResult {
  // -- Path 1: subgraph --
  const subgraphQuery = useQuery({
    queryKey: ["gauges", "subgraph"],
    queryFn: fetchGaugesFromSubgraph,
    // null result means "no endpoint configured" — not an error, just a signal to fall through.
    retry: false,
    staleTime: 30_000,
  });

  const subgraphAvailable =
    subgraphQuery.data !== null && subgraphQuery.data !== undefined;

  // -- Path 2: RPC fallback --
  const listQuery = useReadContracts({
    contracts: [
      {
        address: GAUGE_CONTROLLER_ADDRESS,
        abi: gaugeControllerAbi,
        functionName: "gauges",
      },
    ],
    query: {
      enabled: !subgraphAvailable && !subgraphQuery.isLoading,
      staleTime: 30_000,
    },
  });

  const gaugeAddresses = (listQuery.data?.[0]?.result as readonly Address[] | undefined) ?? undefined;

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

  // -- Compose --
  if (subgraphAvailable && subgraphQuery.data) {
    return {
      gauges: subgraphQuery.data,
      isLoading: false,
      isError: false,
      error: null,
      source: "subgraph",
      refetch: () => void subgraphQuery.refetch(),
    };
  }

  const isLoading =
    subgraphQuery.isLoading ||
    listQuery.isLoading ||
    (!!gaugeAddresses && gaugeAddresses.length > 0 && metaQuery.isLoading);

  const error =
    (subgraphQuery.error as Error | null) ??
    (listQuery.error as Error | null) ??
    (metaQuery.error as Error | null) ??
    null;

  if (error) {
    return {
      gauges: undefined,
      isLoading: false,
      isError: true,
      error,
      source: null,
      refetch: () => {
        void subgraphQuery.refetch();
        void listQuery.refetch();
        void metaQuery.refetch();
      },
    };
  }

  if (!gaugeAddresses || (gaugeAddresses.length > 0 && !metaQuery.data)) {
    return {
      gauges: undefined,
      isLoading,
      isError: false,
      error: null,
      source: null,
      refetch: () => {
        void listQuery.refetch();
        void metaQuery.refetch();
      },
    };
  }

  const gauges: Gauge[] = gaugeAddresses.map((address, i) => {
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
    refetch: () => {
      void listQuery.refetch();
      void metaQuery.refetch();
    },
  };
}
