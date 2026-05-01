"use client";

import { useReadContract } from "wagmi";
import { OPTIMIZER_ADDRESS, VE_MEZO_ADDRESS } from "@/lib/contracts";
import { optimizerAbi, veMezoAbi } from "@/lib/abi";
import type { Address, GaugeAllocationEntry } from "@/lib/types";

export type UseVeMezoPositionResult = {
  /** veMEZO balance in wei (18 decimals). 0n when disconnected. */
  balanceWei: bigint;
  /** User's pinned allocation entries (gauge → weightBps). Empty when none. */
  allocation: GaugeAllocationEntry[];
  isConnected: boolean;
  isLoading: boolean;
};

/**
 * Reads a user's veMEZO position from the deployed testnet stand-in +
 * optimizer. The "position" combines two on-chain reads:
 *   - `MockVeMezo.balanceOf(user)` — total veMEZO weight the wallet
 *     holds. Real Mezo's veMEZO is an ERC-721 voting-escrow NFT
 *     (Tigris's VotingEscrow.sol); the testnet stand-in collapses that
 *     to a single balance for STORY-006 presentation purposes —
 *     sufficient for the BDD requirement "displays my veMEZO balance in
 *     human-readable format". A future tigris-adapter story will
 *     sum-over-NFTs.
 *   - `MezoYieldOptimizer.getAllocation(user)` — the user's pinned weights
 *     across gauges, used by PositionCard's "Allocated: X gauges" summary.
 */
export function useVeMezoPosition(user: Address | undefined): UseVeMezoPositionResult {
  const balanceQuery = useReadContract({
    address: VE_MEZO_ADDRESS,
    abi: veMezoAbi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  const allocationQuery = useReadContract({
    address: OPTIMIZER_ADDRESS,
    abi: optimizerAbi,
    functionName: "getAllocation",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  if (!user) {
    return {
      balanceWei: 0n,
      allocation: [],
      isConnected: false,
      isLoading: false,
    };
  }

  const balanceWei = (balanceQuery.data as bigint | undefined) ?? 0n;
  const allocResult = allocationQuery.data as
    | readonly [readonly Address[], readonly bigint[]]
    | undefined;
  const gauges = allocResult?.[0] ?? [];
  const weights = allocResult?.[1] ?? [];
  const allocation: GaugeAllocationEntry[] = gauges.map((g, i) => ({
    gauge: g,
    weightBps: Number(weights[i] ?? 0n),
  }));

  return {
    balanceWei,
    allocation,
    isConnected: true,
    isLoading: balanceQuery.isLoading || allocationQuery.isLoading,
  };
}
