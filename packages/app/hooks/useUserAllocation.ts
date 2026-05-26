"use client";

import { useReadContract } from "wagmi";
import { OPTIMIZER_ADDRESS } from "@/lib/contracts";
import { optimizerAbi } from "@/lib/abi";
import type { Address, GaugeAllocationEntry } from "@/lib/types";

export type UseUserAllocationResult = {
  entries: GaugeAllocationEntry[];
  isConnected: boolean;
  isLoading: boolean;
};

/**
 * Read a user's pinned allocation from `MezoYieldOptimizer.getAllocation`.
 * Returns an empty array (and `isConnected: false`) when no address is
 * provided — consumers render a "—" placeholder for the user's column
 * without hiding the rest of the gauges.
 */
export function useUserAllocation(user: Address | undefined): UseUserAllocationResult {
  const query = useReadContract({
    address: OPTIMIZER_ADDRESS,
    abi: optimizerAbi,
    functionName: "getAllocation",
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  });

  if (!user) {
    return { entries: [], isConnected: false, isLoading: false };
  }

  const result = query.data as readonly [readonly Address[], readonly bigint[]] | undefined;
  const gauges = result?.[0] ?? [];
  const weights = result?.[1] ?? [];

  const entries: GaugeAllocationEntry[] = gauges.map((g, i) => ({
    gauge: g,
    weightBps: Number(weights[i] ?? 0n),
  }));

  return {
    entries,
    isConnected: true,
    isLoading: query.isLoading,
  };
}
