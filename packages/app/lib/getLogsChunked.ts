import type { PublicClient } from "viem";

/**
 * Mezo testnet RPC (and most public RPCs) caps `eth_getLogs` at a
 * 10_000-block window per call. Our optimizer's deployment block is
 * ~12.7M and current head is many millions ahead, so a single
 * fromBlock=deploy → toBlock=latest call gets rejected with:
 *
 *   "Missing or invalid parameters. ... maximum [from, to] blocks distance: 10000"
 *
 * This helper walks the [from, to] range in `chunkSize` slices,
 * calling `client.getLogs` for each, and concatenates the results.
 *
 * Used by `useYieldHistory` (per-user RewardsClaimed) and
 * `useLeaderboard` (cross-user RewardsClaimed).
 *
 * Performance note: 10M blocks / 10k = 1000 calls. That's slow but
 * acceptable for first-load on the demo; the hooks cache the result
 * via TanStack Query staleTime so subsequent renders don't re-fetch.
 * If load times become a problem, the next move is a Goldsky subgraph
 * (already wired as the fallback in useGaugeData).
 */
export async function getLogsChunked<TArgs>(
  client: PublicClient,
  baseArgs: Omit<Parameters<PublicClient["getLogs"]>[0], "fromBlock" | "toBlock">,
  fromBlock: bigint,
  toBlock: bigint | "latest",
  chunkSize: bigint = 9_999n,
): Promise<TArgs[]> {
  const head =
    toBlock === "latest" ? await client.getBlockNumber() : toBlock;
  const out: unknown[] = [];
  let cursor = fromBlock;
  while (cursor <= head) {
    const end = cursor + chunkSize > head ? head : cursor + chunkSize;
    // viem's getLogs is heavily overloaded; we widen the args type
    // here because the helper is generic across event signatures.
    const logs = (await client.getLogs({
      ...baseArgs,
      fromBlock: cursor,
      toBlock: end,
    } as Parameters<PublicClient["getLogs"]>[0])) as unknown[];
    out.push(...logs);
    cursor = end + 1n;
  }
  return out as TArgs[];
}
