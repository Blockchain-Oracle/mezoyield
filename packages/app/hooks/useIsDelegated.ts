"use client";

import { useReadContract } from "wagmi";
import { OPTIMIZER_ADDRESS } from "@/lib/contracts";
import type { Address } from "@/lib/types";

const isDelegatedAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "isDelegated",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type UseIsDelegatedResult = {
  /** True if the user has opted into Set & Forget delegation. */
  isDelegated: boolean;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Reads `MezoYieldOptimizer.isDelegated(user)`. Used by Dashboard's
 * NextActionCard and Vault's DelegationStatusCard to surface whether
 * Set & Forget is active.
 *
 * Returns `false` (not loading) when no user is connected — disconnected
 * is "not delegated" by definition.
 */
export function useIsDelegated(user: Address | undefined): UseIsDelegatedResult {
  const query = useReadContract({
    address: OPTIMIZER_ADDRESS,
    abi: isDelegatedAbi,
    functionName: "isDelegated",
    args: user ? [user] : undefined,
    query: { enabled: !!user, staleTime: 15_000 },
  });

  return {
    isDelegated: !!query.data,
    isLoading: !!user && query.isLoading,
    refetch: () => void query.refetch(),
  };
}
