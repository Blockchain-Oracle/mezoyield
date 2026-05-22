/**
 * Cross-package constants used by both the app and (selectively) the
 * keeper. Centralized here so the keeper can re-export from a single
 * source via `import` rather than duplicating literals. Magic numbers
 * scattered across hooks/components cause silent drift — when one
 * place updates its CHUNK_SIZE to match the RPC's new limit but
 * another doesn't, only one log scan breaks. This file is the truth.
 */

// ─── Time ──────────────────────────────────────────────────────
/// Unix-aligned weekly voting epoch on Mezo (matches Solidly fork
/// convention used by Tigris/Aerodrome/Velodrome). All "next epoch
/// boundary" math derives from this.
export const SECONDS_PER_EPOCH = 604_800n;
export const SECONDS_PER_EPOCH_NUM = 604_800; // convenience for Math.floor on Date.now()

/// veMEZO lock duration bounds (matches upstream `VotingEscrow.maxLockTime`).
export const MIN_VEMEZO_LOCK_SECONDS = 604_800n; // 1 week
export const MAX_VEMEZO_LOCK_SECONDS = 208n * 604_800n; // ~4 years

// ─── RPC / log scan ────────────────────────────────────────────
/// Mezo Boar RPC's `eth_getLogs` accepts up to 10,000-block windows;
/// we stay one under to leave headroom for inclusive-range edge cases.
export const RPC_LOG_CHUNK_SIZE = 9_999n;

/// Hard ceiling on backward-chunk log scans (used by `useLastVote`
/// when the Optimizer's deployment block is unknown). At Mezo's
/// ~1-4s block time, 120 chunks = ~1.2M blocks = 14-57 days of
/// coverage. If the optimizer has voted in that window we find it;
/// otherwise we surface "—" rather than walk back to genesis.
export const MAX_HISTORICAL_LOG_CHUNKS = 120;

// ─── Keeper gas ────────────────────────────────────────────────
/// Headroom for `Optimizer.castOptimalVote` whose try/catch blinds
/// viem's gas estimator (it sees the outer succeed even when the
/// inner per-user call OOGs). Empirical envelope per user is
/// ~180-220k on mainnet, ~130k on testnet mocks; 200k is the safe
/// ceiling either way. Base 100k covers _checkWeights + loop
/// overhead + VoteCast emit. See packages/keeper/src/keeperGasLimit.ts
/// for the postmortem and the actual usage site.
export const KEEPER_GAS_BASE = 100_000n;
export const KEEPER_GAS_PER_USER = 200_000n;
