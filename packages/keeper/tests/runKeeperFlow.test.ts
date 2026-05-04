import { describe, it, expect, vi } from "vitest";
// Important: import from the side-effect-free `keeperFlow.js`, NOT
// from `runOnce.js`. `runOnce.ts` imports `./config.js` which throws
// at module-load when `KEEPER_PRIVATE_KEY` is absent — that would
// break clean CI runs (codex P1 round 4 on PR #29).
import {
  runKeeperFlow,
  type KeeperFlowDeps,
} from "../src/keeperFlow.js";
import type {
  Allocation,
  GaugeInfo,
} from "../src/computeOptimalAllocation.js";
import type { LastVote } from "../src/lastVoteEpoch.js";

/**
 * Wiring tests for `runKeeperFlow` — the dependency-injected core of
 * `runOnce`. Codex P2 on PR #29 round 4 called out that the
 * skip/submit/force decision tree wasn't covered: pure helpers were
 * tested but the actual integration in runOnce wasn't, so a regression
 * could slip through.
 *
 * These tests verify:
 *   - force=false + same-epoch lastVote   → skip; no loadGauges, no submit
 *   - force=false + no lastVote           → submit
 *   - force=false + older-epoch lastVote  → submit
 *   - force=true                          → bypass guard; never call findLastVote
 *   - empty gauges                        → throws (preserves existing
 *                                            "no gauges registered" semantics)
 *   - notify is called with the resolved allocation when submit succeeds
 *   - currentEpoch is computed from the chain head timestamp, not local clock
 *
 * `runKeeperFlow` takes all IO as injected functions, so these tests
 * use vi.fn() stubs — no viem, no chain, no .env required.
 */

const SECONDS_PER_EPOCH = 604_800n;

function makeGauge(address: `0x${string}`, name: string): GaugeInfo {
  return {
    address,
    name,
    totalVeMezoWei: 1_000_000n * 10n ** 18n,
    bribeMUSDWei: 100n * 10n ** 18n,
  };
}

const FAKE_GAUGE: GaugeInfo = makeGauge(
  "0x0000000000000000000000000000000000000abc",
  "Stability Pool",
);
const FAKE_ALLOCATION: Allocation = {
  gauges: [FAKE_GAUGE.address],
  weights: [10_000n],
};

const FAKE_TX_HASH: `0x${string}` = "0xfeeddeadbeef0000000000000000000000000000000000000000000000000001";
const FAKE_BLOCK = 12_900_000n;

// Pin a chain head timestamp inside epoch 2939 (matches the real Mezo
// epoch as of the PR — keeps the test math grounded).
const HEAD_TS_IN_EPOCH_2939 = SECONDS_PER_EPOCH * 2939n + 1_000n;
const EPOCH_2939_START = SECONDS_PER_EPOCH * 2939n;

function makeDeps(overrides: Partial<KeeperFlowDeps> = {}): KeeperFlowDeps {
  return {
    getHeadTimestamp: vi.fn().mockResolvedValue(HEAD_TS_IN_EPOCH_2939),
    findLastVote: vi.fn().mockResolvedValue(null),
    loadGauges: vi.fn().mockResolvedValue([FAKE_GAUGE]),
    computeAllocation: vi.fn().mockReturnValue(FAKE_ALLOCATION),
    submitVote: vi
      .fn()
      .mockResolvedValue({ txHash: FAKE_TX_HASH, blockNumber: FAKE_BLOCK }),
    notify: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("runKeeperFlow — skip path (codex P1)", () => {
  it("skips submission when same-epoch VoteCast already on chain", async () => {
    const sameEpochVote: LastVote = {
      blockNumber: 12_829_351n,
      blockTimestamp: HEAD_TS_IN_EPOCH_2939 - 100n, // also in epoch 2939
      epoch: 2939,
    };
    const deps = makeDeps({
      findLastVote: vi.fn().mockResolvedValue(sameEpochVote),
    });

    const result = await runKeeperFlow(deps, { force: false });

    expect(result).toEqual({
      status: "skipped",
      reason: "already-voted-this-epoch",
      epoch: 2939,
    });
    // Critical: no gauge load, no allocation, no submission.
    expect(deps.loadGauges).not.toHaveBeenCalled();
    expect(deps.computeAllocation).not.toHaveBeenCalled();
    expect(deps.submitVote).not.toHaveBeenCalled();
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it("calls findLastVote with the start of the current epoch as the bound", async () => {
    const deps = makeDeps();
    await runKeeperFlow(deps, { force: false });
    expect(deps.findLastVote).toHaveBeenCalledTimes(1);
    expect(deps.findLastVote).toHaveBeenCalledWith(EPOCH_2939_START);
  });

  it("computes epoch from chain head timestamp (not local clock)", async () => {
    // If we were using local Date.now() instead of the chain head, this
    // test would fail because the test runner's clock isn't pinned to
    // epoch 2939. The fact that runKeeperFlow returns epoch=2939 proves
    // it's reading from the injected getHeadTimestamp.
    const deps = makeDeps();
    const result = await runKeeperFlow(deps, { force: false });
    expect(result.epoch).toBe(2939);
  });
});

describe("runKeeperFlow — submit path", () => {
  it("submits when no prior vote exists (fresh deploy)", async () => {
    const deps = makeDeps({
      findLastVote: vi.fn().mockResolvedValue(null),
    });

    const result = await runKeeperFlow(deps, { force: false });

    expect(result).toEqual({
      status: "submitted",
      txHash: FAKE_TX_HASH,
      epoch: 2939,
    });
    expect(deps.loadGauges).toHaveBeenCalledTimes(1);
    expect(deps.computeAllocation).toHaveBeenCalledWith([FAKE_GAUGE]);
    expect(deps.submitVote).toHaveBeenCalledWith(FAKE_ALLOCATION);
  });

  it("submits when prior vote was in an older epoch (boundary crossed)", async () => {
    const olderVote: LastVote = {
      blockNumber: 12_700_000n,
      blockTimestamp: SECONDS_PER_EPOCH * 2938n + 1_000n,
      epoch: 2938,
    };
    const deps = makeDeps({
      findLastVote: vi.fn().mockResolvedValue(olderVote),
    });

    const result = await runKeeperFlow(deps, { force: false });

    expect(result.status).toBe("submitted");
    expect(deps.submitVote).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses the guard entirely (never calls findLastVote)", async () => {
    const deps = makeDeps({
      // Even if we WOULD have found a same-epoch vote, force should
      // bypass the call. Verify findLastVote is never invoked.
      findLastVote: vi.fn(),
    });

    const result = await runKeeperFlow(deps, { force: true });

    expect(result.status).toBe("submitted");
    expect(deps.findLastVote).not.toHaveBeenCalled();
    expect(deps.submitVote).toHaveBeenCalledWith(FAKE_ALLOCATION);
  });

  it("notifies with resolved allocation breakdown after submit", async () => {
    const deps = makeDeps();
    await runKeeperFlow(deps, { force: false });
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith({
      txHash: FAKE_TX_HASH,
      blockNumber: FAKE_BLOCK.toString(),
      allocation: [{ name: "Stability Pool", weightBps: 10_000 }],
    });
  });

  it("notify is optional — submission still works when omitted", async () => {
    const deps = makeDeps({ notify: undefined });
    const result = await runKeeperFlow(deps, { force: false });
    expect(result.status).toBe("submitted");
  });
});

describe("runKeeperFlow — error path", () => {
  it("throws when no gauges are registered (preserves existing behavior)", async () => {
    const deps = makeDeps({
      loadGauges: vi.fn().mockResolvedValue([]),
    });

    await expect(runKeeperFlow(deps, { force: false })).rejects.toThrow(
      /no gauges registered/,
    );
    expect(deps.submitVote).not.toHaveBeenCalled();
  });
});
