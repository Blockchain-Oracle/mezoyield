import { type PublicClient } from "viem";

// NB: this module deliberately does NOT import from `./config.js`.
// Codex P1 on PR #29 (round 2): config.ts throws at module-load when
// `KEEPER_PRIVATE_KEY` is absent, so any import of lastVoteEpoch.ts in
// a clean CI environment (no .env, no secrets) would crash before
// vitest could even collect the test file. The viem-bound entrypoint
// `getLastVote` now takes its deployment context (address + floor
// block) as parameters so this file stays pure and fully unit-testable
// without side effects.

/**
 * Read the most recent `VoteCast` event from the optimizer and return
 * the epoch index (Unix-aligned 7-day buckets) it landed in.
 *
 * Why this exists: codex flagged a P1 — the daily cron + boot run
 * (`packages/keeper/src/index.ts`) calls `castOptimalVote()` every
 * day, but the contract performs no per-epoch dedupe (verified in
 * `MockGaugeController.voteForGaugeWeights` — it overwrites
 * `lastVote*` arrays on every call). Without a guard at the keeper
 * layer, a fresh deployment + daily reboot would emit ~7× more
 * `VoteCast` events than there are reward epochs, spamming the
 * landing's ProofLedger and burning keeper gas.
 *
 * The epoch index is `floor(blockTimestamp / 604_800)` — same
 * boundary the frontend uses in `useYieldHistory.ts`. Two votes in
 * the same epoch index → skip the second.
 *
 * Backward chunked walk (mirrors `useLastVote` in the app), 9999-block
 * windows, max 30 chunks. Returns `null` when no VoteCast has ever
 * been emitted (keeper should always cast on the first run).
 *
 * The pure inner `findLatestVoteFromChunks` is exported separately so
 * unit tests can exercise the loop with injected fetchers — codex P1
 * on the same PR called out "off-by-one epoch or missing event path"
 * as the high-risk failure mode. Tests cover those branches.
 */

/**
 * Per-epoch dedup keys off `TickAttempted` (emitted every call to
 * `castOptimalVote`), NOT `VoteCast` (only emitted on successful
 * ticks). Without this, a no-delegates or all-fail tick leaves no
 * marker — the next daily cron run within the same epoch re-submits
 * a doomed tx and burns gas + spams VoteSkipped logs. Codex P1 round
 * 3 on the v3 PR caught this gap after Phase A's "VoteCast only on
 * success" fix.
 *
 * Frontend's `useLastVote` correctly continues to walk `VoteCast` —
 * it's the user-facing "successful vote happened" signal for the
 * ProofLedger receipt + dashboard heartbeat chip.
 */
const TICK_ATTEMPTED_EVENT = {
  type: "event",
  name: "TickAttempted",
  inputs: [
    { name: "timestamp", type: "uint256", indexed: false },
    { name: "successCount", type: "uint256", indexed: false },
    { name: "delegatedUserCount", type: "uint256", indexed: false },
  ],
  anonymous: false,
} as const;

export const CHUNK_SIZE = 9_999n;
export const MAX_CHUNKS = 30;
export const SECONDS_PER_EPOCH = 604_800n;

export type LastVote = {
  blockNumber: bigint;
  blockTimestamp: bigint;
  /** Unix-aligned epoch index — `floor(timestamp / 604_800)`. */
  epoch: number;
};

/**
 * Minimal log shape this helper needs from the chain. Matches the
 * subset of viem's `Log` we read; tests can supply their own without
 * pulling in the rest of viem.
 */
export type VoteCastLogLike = {
  blockNumber: bigint | null;
};

/**
 * Pure backward-walking loop. Takes injected fetchers so tests don't
 * need a real PublicClient.
 *
 * Termination policy depends on whether `earliestRelevantTimestamp`
 * is provided:
 *
 *   BOUNDED PATH (timestamp bound set, used by the keeper):
 *     - The timestamp bound is the PRIMARY terminator. Walk continues
 *       past empty chunks UNTIL the chunk's `from`-block timestamp
 *       drops below the bound, OR we hit `floor`. `maxChunks` is
 *       ignored in this path: codex P1 round 3 on PR #29 showed that
 *       a fixed-block ceiling can cut off the scan BEFORE the
 *       timestamp bound trips, missing a same-epoch event near the
 *       start of the epoch on fast-block chains.
 *     - Invariant guaranteed: the scan covers at least one epoch's
 *       worth of chain time, regardless of block speed.
 *
 *   UNBOUNDED PATH (no timestamp bound):
 *     - `maxChunks` is the ceiling. Used by callers that want the
 *       latest vote of all time without committing to scanning
 *       genesis-onward (rare in practice; keeper always uses the
 *       bounded path, but the API stays general).
 *
 *   In both paths, `floor` (the deployment block) is always
 *   respected — anything earlier can't contain VoteCast events for
 *   this contract.
 *
 * The timestamp check fetches one extra `getBlock` per empty chunk
 * (bounded path only). One extra RPC call per ~9999-block window —
 * worth it for the dedup guarantee.
 */
export async function findLatestVoteFromChunks(args: {
  head: bigint;
  floor: bigint;
  chunkSize: bigint;
  maxChunks: number;
  earliestRelevantTimestamp?: bigint;
  fetchLogs: (from: bigint, to: bigint) => Promise<VoteCastLogLike[]>;
  fetchBlockTimestamp: (blockNumber: bigint) => Promise<bigint>;
}): Promise<LastVote | null> {
  const {
    head,
    floor,
    chunkSize,
    maxChunks,
    earliestRelevantTimestamp,
    fetchLogs,
    fetchBlockTimestamp,
  } = args;
  const isBounded = earliestRelevantTimestamp != null;
  let to = head;
  let chunks = 0;

  while (to >= floor) {
    // Unbounded path: cap at maxChunks. Bounded path ignores maxChunks
    // — the timestamp bound handles termination, see policy above.
    if (!isBounded && chunks >= maxChunks) return null;

    const from = to > floor + chunkSize ? to - chunkSize : floor;
    const logs = await fetchLogs(from, to);
    chunks++;

    if (logs.length > 0) {
      const last = logs[logs.length - 1];
      if (last.blockNumber == null) return null;
      const ts = await fetchBlockTimestamp(last.blockNumber);
      return {
        blockNumber: last.blockNumber,
        blockTimestamp: ts,
        epoch: Number(ts / SECONDS_PER_EPOCH),
      };
    }

    // Bounded path: stop when the chunk's `from`-block is older than
    // the bound — no earlier event can be in scope.
    if (isBounded) {
      const fromTs = await fetchBlockTimestamp(from);
      if (fromTs < earliestRelevantTimestamp!) return null;
    }

    if (from === floor) break;
    to = from - 1n;
  }

  return null;
}

export type OptimizerDeployment = {
  address: `0x${string}`;
  /** Lower bound for backward log walks — block number the contract
   *  was deployed in. Anything earlier can't contain VoteCast events. */
  deploymentBlock: bigint;
};

/**
 * viem-bound entrypoint used by `runOnce.ts`. Wires the deployment-
 * block floor, the optimizer address, and the VoteCast event into the
 * pure walker.
 *
 * Takes `OptimizerDeployment` as a parameter rather than importing
 * config to keep this module pure — see the file header for why.
 */
export async function getLastVote(
  client: PublicClient,
  deployment: OptimizerDeployment,
  /** Optional timestamp bound — typically the start of the current
   *  epoch. The walk stops once it has scanned past this timestamp
   *  without finding an event. See `findLatestVoteFromChunks` for the
   *  rationale (codex P1 round 3). */
  earliestRelevantTimestamp?: bigint,
): Promise<LastVote | null> {
  const head = await client.getBlockNumber();
  return findLatestVoteFromChunks({
    head,
    floor: deployment.deploymentBlock,
    chunkSize: CHUNK_SIZE,
    maxChunks: MAX_CHUNKS,
    earliestRelevantTimestamp,
    fetchLogs: async (from, to) => {
      const logs = await client.getLogs({
        address: deployment.address,
        event: TICK_ATTEMPTED_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      return logs.map((l) => ({ blockNumber: l.blockNumber }));
    },
    fetchBlockTimestamp: async (blockNumber) => {
      const block = await client.getBlock({ blockNumber });
      return block.timestamp;
    },
  });
}

/**
 * Pure helper: epoch index for an arbitrary unix timestamp (in seconds).
 * Exposed so the cron caller can compute the current epoch from
 * `Date.now()` (or, more accurately, from a fresh chain block) and
 * compare with `getLastVote().epoch`.
 */
export function epochOf(unixSeconds: bigint): number {
  return Number(unixSeconds / SECONDS_PER_EPOCH);
}

/**
 * Pure decision helper: should the keeper submit a vote, or skip
 * because we already voted this epoch? Exposed for unit testing
 * without spinning up viem clients.
 *
 *   force=true                                → always submit
 *   no prior vote (lastVote=null)             → submit
 *   prior vote in a different (older) epoch   → submit
 *   prior vote in the current epoch           → skip
 */
export function shouldSubmitVote(args: {
  currentEpoch: number;
  lastVote: LastVote | null;
  force: boolean;
}): { submit: true } | { submit: false; reason: "already-voted-this-epoch" } {
  if (args.force) return { submit: true };
  if (args.lastVote == null) return { submit: true };
  if (args.lastVote.epoch === args.currentEpoch) {
    return { submit: false, reason: "already-voted-this-epoch" };
  }
  return { submit: true };
}
