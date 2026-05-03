"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  OPTIMIZER_ADDRESS,
  OPTIMIZER_DEPLOYMENT_BLOCK,
} from "@/lib/contracts";
import { optimizerAbi } from "@/lib/abi";
import type { Address } from "@/lib/types";

const REWARDS_CLAIMED_EVENT = optimizerAbi.find(
  (item) => item.type === "event" && item.name === "RewardsClaimed",
);

export type LeaderboardEntry = {
  user: Address;
  totalWei: bigint;
  claimCount: number;
};

export type UseLeaderboardResult = {
  rows: LeaderboardEntry[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

/**
 * Aggregate `RewardsClaimed` events from the optimizer across ALL
 * users. Sums per-user MUSD claimed and counts claims; sorts descending
 * by total. Returns the top 20.
 *
 * Sourced from `usePublicClient.getLogs` over the deployment-bounded
 * window — same primitive as useYieldHistory's per-user variant. No
 * subgraph dependency.
 */
export function useLeaderboard(limit = 20): UseLeaderboardResult {
  const client = usePublicClient();

  const query = useQuery({
    queryKey: ["leaderboard", limit],
    enabled: !!client && !!REWARDS_CLAIMED_EVENT,
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!client || !REWARDS_CLAIMED_EVENT) return [];
      const logs = await client.getLogs({
        address: OPTIMIZER_ADDRESS,
        event: REWARDS_CLAIMED_EVENT,
        fromBlock: OPTIMIZER_DEPLOYMENT_BLOCK,
        toBlock: "latest",
      });
      const totals = new Map<Address, { wei: bigint; count: number }>();
      for (const log of logs) {
        const args = log.args as { user?: Address; amount?: bigint };
        const user = args.user;
        const amount = args.amount ?? 0n;
        if (!user) continue;
        const prev = totals.get(user) ?? { wei: 0n, count: 0 };
        totals.set(user, { wei: prev.wei + amount, count: prev.count + 1 });
      }
      const ordered: LeaderboardEntry[] = [...totals.entries()]
        .map(([user, v]) => ({ user, totalWei: v.wei, claimCount: v.count }))
        .sort((a, b) => (b.totalWei > a.totalWei ? 1 : b.totalWei < a.totalWei ? -1 : 0));
      return ordered.slice(0, limit);
    },
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
