/**
 * Gas-limit headroom for `MezoYieldOptimizer.castOptimalVote`.
 *
 * Why this exists: `castOptimalVote` iterates `_delegatedUsers[]` and
 * calls `adapter.voteForUser(...)` per user wrapped in `try`/`catch`.
 * viem's `estimateGas` simulates the outer call and sees it succeed
 * (try traps any inner OOG and the catch path emits `VoteSkipped`
 * without reverting), so the estimator routinely under-allocates by
 * ~30%. The inner adapter→BoostVoter call then OOGs at ~144 k gas,
 * the catch swallows it as empty-bytes revert, and the keeper logs
 * a spurious `VoteSkipped` for what should have been a successful
 * tick. Concrete proof: `debug_traceTransaction` on testnet tx
 * `0x4cfd33e0…2bdf` showed `error="out of gas"` on the inner call
 * at exactly 144,018 gas of 144,018 allocated.
 *
 * Empirical safe envelope per user (BoostVoterAdapter →
 * BoostVoter.vote with 2 gauges, 1 NFT lookup):
 *   - mock path (testnet MockGaugeController): ~130k
 *   - real path (mainnet BoostVoterAdapter → BoostVoter):
 *     ~180–220k depending on epoch state, cold/warm SLOADs
 *   - we pick 200k as the safe ceiling
 *
 * Base 100k covers Optimizer.castOptimalVote's own _checkWeights,
 * the loop overhead, and the summary `VoteCast` event emission.
 *
 * If a tick has 0 delegated users the formula still returns 100k —
 * the outer call's loop runs 0 times, well under the cap. If the
 * delegated count grows (say > 50), revisit: at that scale the
 * keeper should switch to a paginated `castOptimalVoteFor(subset)`
 * overload to stay under block gas.
 */
// Bumped from 100k+200k after mainnet walkthrough on 2026-05-22 showed
// real BoostVoter.vote burns ~250-400k per inner call (writes vote
// weights for multiple gauges + emits multiple events + Solidly
// bookkeeping). 300k base + 600k/user keeps headroom comfortable even
// for 4-5 gauge votes.
const KEEPER_GAS_BASE = 300_000n;
const KEEPER_GAS_PER_USER = 600_000n;

export function keeperGasLimitFor(delegatedUserCount: bigint): bigint {
  return KEEPER_GAS_BASE + KEEPER_GAS_PER_USER * delegatedUserCount;
}
