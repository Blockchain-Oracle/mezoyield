"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  OPTIMIZER_ADDRESS,
  OPTIMIZER_DEPLOYMENT_BLOCK,
} from "@/lib/contracts";
import { optimizerAbi } from "@/lib/abi";
import type { Address } from "@/lib/types";

/**
 * The most recent on-chain `VoteCast` from the keeper. Powers the
 * landing page's ProofLedger section — the editorial-noir receipt that
 * answers "does this product actually run?" with a tx hash instead of
 * marketing copy.
 *
 * Why a dedicated hook (not a slice of useGaugeData / useYieldHistory):
 * VoteCast is anonymous-cohort (no `user` index), so the existing per-
 * user hooks can't surface it. And we only ever want the *most recent*
 * one — bucketing or aggregating would be wasted work.
 *
 * Why walk backward (not the forward chunked walker in
 * `lib/getLogsChunked.ts`): the keeper has fired ~weekly since deploy.
 * Forward walking from OPTIMIZER_DEPLOYMENT_BLOCK at 10k blocks/chunk
 * is ~30 requests before we even see the first vote. Walking backward
 * from `latest` stops at the first chunk with a match — usually 1
 * request. The forward helper exists for hooks that need ALL logs
 * (yield history, leaderboard); ProofLedger only needs the tail.
 */

const VOTE_CAST_EVENT = optimizerAbi.find(
  (item) => item.type === "event" && item.name === "VoteCast",
);

const CHUNK_SIZE = 9_999n;
// Hard ceiling on backward chunks — protects against a degenerate case
// where no VoteCast has ever been emitted. Codex P2 (PR #29): the prior
// 30-chunk cap = ~300k blocks. Mezo testnet runs ~4s/block today, so
// 30 chunks covered ~14 days — fine for 2 epochs but tight on faster
// chains (a 1–2s mainnet would collapse this window below one epoch
// and the ProofLedger would show empty for a recently-fired keeper).
// 120 chunks = ~1.2M blocks: ~57 days on Mezo testnet, ~14 days even
// at 1s/block. If the keeper has never fired in that window, we
// surface "—" rather than hammer the RPC for every block since deploy.
const MAX_CHUNKS = 120;

export type LastVote = {
  txHash: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: bigint;
  gauges: readonly Address[];
  weights: readonly bigint[];
};

export type UseLastVoteResult = {
  vote: LastVote | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

export function useLastVote(): UseLastVoteResult {
  const client = usePublicClient();

  const query = useQuery({
    queryKey: ["last-vote", OPTIMIZER_ADDRESS],
    enabled: !!client && !!VOTE_CAST_EVENT,
    retry: false,
    // 30s aligns with useGaugeData; the keeper fires at most once per
    // epoch boundary, so refetching more aggressively wastes RPC budget.
    staleTime: 30_000,
    queryFn: async (): Promise<LastVote | undefined> => {
      if (!client || !VOTE_CAST_EVENT) return undefined;

      const head = await client.getBlockNumber();
      let to = head;
      const floor = OPTIMIZER_DEPLOYMENT_BLOCK;

      type VoteCastLog = {
        blockNumber: bigint | null;
        transactionHash: `0x${string}` | null;
        args: { gauges?: readonly Address[]; weights?: readonly bigint[] };
      };

      for (let i = 0; i < MAX_CHUNKS && to >= floor; i++) {
        const from = to > floor + CHUNK_SIZE ? to - CHUNK_SIZE : floor;
        const logs = (await client.getLogs({
          address: OPTIMIZER_ADDRESS,
          event: VOTE_CAST_EVENT,
          fromBlock: from,
          toBlock: to,
        } as Parameters<typeof client.getLogs>[0])) as unknown as VoteCastLog[];

        if (logs.length > 0) {
          // Take the LAST log in the chunk (highest block in this window).
          const last = logs[logs.length - 1];
          if (
            last.transactionHash == null ||
            last.blockNumber == null ||
            !last.args.gauges ||
            !last.args.weights
          ) {
            return undefined;
          }
          const block = await client.getBlock({ blockNumber: last.blockNumber });
          return {
            txHash: last.transactionHash,
            blockNumber: last.blockNumber,
            blockTimestamp: block.timestamp,
            gauges: last.args.gauges,
            weights: last.args.weights,
          };
        }

        if (from === floor) break;
        to = from - 1n;
      }

      return undefined;
    },
  });

  return {
    vote: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
