import { describe, it, expect, vi } from "vitest";
import {
  CHUNK_SIZE,
  MAX_CHUNKS,
  SECONDS_PER_EPOCH,
  epochOf,
  findLatestVoteFromChunks,
  shouldSubmitVote,
  type LastVote,
  type VoteCastLogLike,
} from "../src/lastVoteEpoch.js";

/**
 * Unit tests for the keeper's per-epoch dedup helper.
 *
 * Codex flagged a P1 on PR #29 calling out "off-by-one epoch or
 * missing event path would silently stop or duplicate keeper votes."
 * This file covers exactly those branches:
 *
 *   - epochOf math at boundary conditions (0, exactly-on, exactly-off)
 *   - the backward-walking loop with no events ever (returns null)
 *   - one event in the head chunk (immediate hit)
 *   - event in an earlier chunk (loop walks backward)
 *   - MAX_CHUNKS ceiling (gives up rather than hitting genesis)
 *   - floor block respected (clamps `from` to deployment block)
 *   - last log in chunk wins (most recent block within window)
 *   - blockNumber=null log (defensive — viem can return that on pending)
 *
 * The tests stub `fetchLogs` and `fetchBlockTimestamp` so the loop
 * runs purely without a viem PublicClient or RPC. The viem-bound
 * `getLastVote` is a thin wrapper, exercised by the live integration
 * smoke (`packages/contracts/test/integration/proof-of-functionality.test.ts`).
 */

const FLOOR = 12_758_568n; // matches the optimizer's deployment block
const HEAD = 12_900_000n; // ~141k blocks ahead — multiple chunks

describe("epochOf", () => {
  it("returns 0 for timestamp 0", () => {
    expect(epochOf(0n)).toBe(0);
  });

  it("returns 0 just before the first epoch boundary", () => {
    expect(epochOf(SECONDS_PER_EPOCH - 1n)).toBe(0);
  });

  it("rolls to epoch 1 exactly at the boundary", () => {
    expect(epochOf(SECONDS_PER_EPOCH)).toBe(1);
  });

  it("matches floor(ts / 604_800) for arbitrary timestamps", () => {
    const ts = 1_777_900_000n; // a real-ish chain timestamp (~early 2026)
    expect(epochOf(ts)).toBe(Number(ts / SECONDS_PER_EPOCH));
  });
});

describe("findLatestVoteFromChunks", () => {
  it("returns null when no events have ever been emitted", async () => {
    const fetchLogs = vi.fn().mockResolvedValue([]);
    const fetchBlockTimestamp = vi.fn();

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).toBeNull();
    // Walks every chunk down to floor, but should never call the
    // timestamp fetcher (no events found).
    expect(fetchBlockTimestamp).not.toHaveBeenCalled();
    // Loop should bottom out — `to` slides from HEAD to FLOOR. Number
    // of iterations is bounded by both maxChunks AND the (head - floor)
    // span, whichever is smaller.
    expect(fetchLogs.mock.calls.length).toBeGreaterThan(0);
  });

  it("returns the event in the first chunk when it lives near head", async () => {
    const eventBlock = HEAD - 100n;
    const eventTs = 1_777_000_000n; // arbitrary; epoch = floor(ts/604800)
    const fetchLogs = vi
      .fn()
      .mockResolvedValueOnce([{ blockNumber: eventBlock } satisfies VoteCastLogLike])
      .mockResolvedValue([]); // shouldn't be called again
    const fetchBlockTimestamp = vi.fn().mockResolvedValue(eventTs);

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).not.toBeNull();
    expect(result!.blockNumber).toBe(eventBlock);
    expect(result!.blockTimestamp).toBe(eventTs);
    expect(result!.epoch).toBe(Number(eventTs / SECONDS_PER_EPOCH));
    expect(fetchLogs).toHaveBeenCalledTimes(1);
    expect(fetchBlockTimestamp).toHaveBeenCalledTimes(1);
  });

  it("walks backward when the event is in an earlier chunk", async () => {
    // Empty for the first 2 chunks, then a hit on chunk 3.
    const eventBlock = HEAD - CHUNK_SIZE * 2n - 50n;
    const eventTs = 1_776_000_000n;
    const fetchLogs = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ blockNumber: eventBlock } satisfies VoteCastLogLike])
      .mockResolvedValue([]);
    const fetchBlockTimestamp = vi.fn().mockResolvedValue(eventTs);

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).not.toBeNull();
    expect(result!.blockNumber).toBe(eventBlock);
    expect(fetchLogs).toHaveBeenCalledTimes(3); // walked back 3 chunks before finding
  });

  it("respects MAX_CHUNKS — stops scanning before reaching genesis", async () => {
    // Floor far enough from head that maxChunks*chunkSize < (head - floor).
    // Loop must give up after maxChunks calls, even if no event found.
    const farHead = 100_000_000n;
    const farFloor = 0n;
    const fetchLogs = vi.fn().mockResolvedValue([]);
    const fetchBlockTimestamp = vi.fn();

    const result = await findLatestVoteFromChunks({
      head: farHead,
      floor: farFloor,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).toBeNull();
    expect(fetchLogs).toHaveBeenCalledTimes(MAX_CHUNKS);
  });

  it("clamps the lower bound to the floor block (no underflow)", async () => {
    // Head is just inside the floor — backward walk would underflow if
    // we didn't clamp. Should issue exactly one fetch with from=floor.
    const head = FLOOR + 500n;
    const fetchLogs = vi.fn().mockResolvedValue([]);
    const fetchBlockTimestamp = vi.fn();

    const result = await findLatestVoteFromChunks({
      head,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).toBeNull();
    expect(fetchLogs).toHaveBeenCalledTimes(1);
    const [from, to] = fetchLogs.mock.calls[0];
    expect(from).toBe(FLOOR);
    expect(to).toBe(head);
  });

  it("returns the LAST log in a multi-event chunk (most recent block wins)", async () => {
    const olderBlock = HEAD - 200n;
    const newerBlock = HEAD - 100n;
    const newerTs = 1_777_900_000n;
    const fetchLogs = vi.fn().mockResolvedValueOnce([
      { blockNumber: olderBlock } satisfies VoteCastLogLike,
      { blockNumber: newerBlock } satisfies VoteCastLogLike,
    ]);
    const fetchBlockTimestamp = vi.fn().mockResolvedValue(newerTs);

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).not.toBeNull();
    expect(result!.blockNumber).toBe(newerBlock);
    expect(fetchBlockTimestamp).toHaveBeenCalledWith(newerBlock);
  });

  it("with timestamp bound: keeps scanning past maxChunks until bound trips (codex P1 r3)", async () => {
    // The exact invariant codex flagged: when the current epoch spans
    // more than `maxChunks * chunkSize` blocks, the loop MUST keep
    // going past the maxChunks ceiling until the timestamp bound is
    // reached — otherwise we silently miss a same-epoch event and the
    // dedup re-introduces duplicate keeper votes.
    //
    // Set up: maxChunks=5 (a low ceiling), but the same-epoch event
    // sits in chunk 8 (well past the ceiling). The timestamp bound is
    // configured so chunks 1-9 are all in scope. Without the fix the
    // walk would exit after chunk 5; with the fix it walks until it
    // finds the event in chunk 8.
    const earliestRelevantTimestamp = 1_000_000_000n;
    const eventBlock = HEAD - CHUNK_SIZE * 7n - 50n; // in chunk 8
    const eventTs = earliestRelevantTimestamp + 5_000n;

    const fetchLogs = vi.fn();
    // First 7 chunks: empty.
    for (let i = 0; i < 7; i++) {
      fetchLogs.mockResolvedValueOnce([]);
    }
    // Chunk 8: the event.
    fetchLogs.mockResolvedValueOnce([
      { blockNumber: eventBlock } satisfies VoteCastLogLike,
    ]);

    // For each empty chunk we ask the from-block timestamp. All are
    // newer than the bound (otherwise the bound check would terminate
    // before maxChunks-violating behavior is exercised).
    const fetchBlockTimestamp = vi.fn();
    for (let i = 0; i < 7; i++) {
      fetchBlockTimestamp.mockResolvedValueOnce(
        earliestRelevantTimestamp + 10_000n,
      );
    }
    // Final call: the event's block timestamp.
    fetchBlockTimestamp.mockResolvedValueOnce(eventTs);

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: 5, // intentionally low to prove maxChunks is ignored when bound is set
      earliestRelevantTimestamp,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).not.toBeNull();
    expect(result!.blockNumber).toBe(eventBlock);
    expect(fetchLogs).toHaveBeenCalledTimes(8);
  });

  it("with timestamp bound: stops walking when chunk's from-block is older than bound", async () => {
    // Codex P1 round 3 invariant: scan must always cover at least one
    // epoch's worth of chain time, regardless of block speed. The way
    // we guarantee that is the timestamp bound — keep walking past
    // empty chunks until the chunk's `from` timestamp drops below
    // `earliestRelevantTimestamp`. THEN stop.
    //
    // Set up: 5 empty chunks, all returning empty logs. Chunks 1-2
    // have from-block timestamps NEWER than the bound (so the walk
    // continues). Chunk 3's from-block is OLDER than the bound, so
    // the walk should stop after chunk 3 — never asking for chunks
    // 4-5.
    const earliestRelevantTimestamp = 1_000_000_000n;
    const fetchLogs = vi.fn().mockResolvedValue([]);
    // Block timestamps decrease as block number decreases (going back
    // in time). Chunk 1 from-block is +200, chunk 2 +100, chunk 3 -50
    // (below bound).
    const fetchBlockTimestamp = vi
      .fn()
      .mockResolvedValueOnce(earliestRelevantTimestamp + 200n)
      .mockResolvedValueOnce(earliestRelevantTimestamp + 100n)
      .mockResolvedValueOnce(earliestRelevantTimestamp - 50n);

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      earliestRelevantTimestamp,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).toBeNull();
    expect(fetchLogs).toHaveBeenCalledTimes(3); // walked 3 chunks, stopped after bound check
    expect(fetchBlockTimestamp).toHaveBeenCalledTimes(3);
  });

  it("with timestamp bound: still finds a same-epoch event before the bound trips", async () => {
    // The bound should NOT short-circuit when an event exists in scope.
    // Walk 1: empty (above bound). Walk 2: returns the event.
    const earliestRelevantTimestamp = 1_000_000_000n;
    const eventBlock = HEAD - CHUNK_SIZE - 50n;
    const eventTs = earliestRelevantTimestamp + 5_000n; // inside the relevant window
    const fetchLogs = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ blockNumber: eventBlock } satisfies VoteCastLogLike]);
    const fetchBlockTimestamp = vi
      .fn()
      .mockResolvedValueOnce(earliestRelevantTimestamp + 10_000n) // chunk 1 from-block — still above bound, walk continues
      .mockResolvedValueOnce(eventTs); // event's block timestamp

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      earliestRelevantTimestamp,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).not.toBeNull();
    expect(result!.blockNumber).toBe(eventBlock);
    expect(result!.blockTimestamp).toBe(eventTs);
  });

  it("returns null when the matched log has blockNumber=null (pending)", async () => {
    // Defensive: viem can surface in-flight pending logs with null
    // block numbers. We can't compute an epoch without a block, so the
    // helper bails — keeper should treat that as 'no recent vote' and
    // submit, not skip silently.
    const fetchLogs = vi
      .fn()
      .mockResolvedValueOnce([{ blockNumber: null } satisfies VoteCastLogLike]);
    const fetchBlockTimestamp = vi.fn();

    const result = await findLatestVoteFromChunks({
      head: HEAD,
      floor: FLOOR,
      chunkSize: CHUNK_SIZE,
      maxChunks: MAX_CHUNKS,
      fetchLogs,
      fetchBlockTimestamp,
    });

    expect(result).toBeNull();
    expect(fetchBlockTimestamp).not.toHaveBeenCalled();
  });
});

describe("shouldSubmitVote", () => {
  const lastVoteThisEpoch: LastVote = {
    blockNumber: 12_829_351n,
    blockTimestamp: 1_777_900_000n,
    epoch: 2939,
  };
  const lastVotePrevEpoch: LastVote = {
    blockNumber: 12_750_000n,
    blockTimestamp: 1_777_300_000n,
    epoch: 2938,
  };

  it("submits when force=true even if already voted this epoch", () => {
    expect(
      shouldSubmitVote({ currentEpoch: 2939, lastVote: lastVoteThisEpoch, force: true }),
    ).toEqual({ submit: true });
  });

  it("submits when there is no prior vote (first run on a fresh deploy)", () => {
    expect(
      shouldSubmitVote({ currentEpoch: 2939, lastVote: null, force: false }),
    ).toEqual({ submit: true });
  });

  it("submits when prior vote was in an older epoch (epoch boundary crossed)", () => {
    expect(
      shouldSubmitVote({
        currentEpoch: 2939,
        lastVote: lastVotePrevEpoch,
        force: false,
      }),
    ).toEqual({ submit: true });
  });

  it("skips when prior vote was in the current epoch (the codex P1 case)", () => {
    expect(
      shouldSubmitVote({
        currentEpoch: 2939,
        lastVote: lastVoteThisEpoch,
        force: false,
      }),
    ).toEqual({ submit: false, reason: "already-voted-this-epoch" });
  });

  it("submits even with same-epoch lastVote when force overrides", () => {
    // The KEEPER_FORCE=1 (default for `pnpm once`) path relies on this
    // — the demo invocation always emits a fresh receipt regardless of
    // whether the cron loop already voted in this epoch.
    expect(
      shouldSubmitVote({
        currentEpoch: 2939,
        lastVote: lastVoteThisEpoch,
        force: true,
      }),
    ).toEqual({ submit: true });
  });
});
