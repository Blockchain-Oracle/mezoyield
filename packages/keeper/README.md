# `@mezoyield/keeper`

The MezoYield **Set & Forget** keeper bot. Runs once per Mezo gauge
epoch (~7 days), reads live gauge state from the optimizer's
controller + Matchbox bribe pool, computes the highest-APY allocation,
and submits `castOptimalVote(gauges, weights)` on the optimizer.

Without this bot, the *Set & Forget* strategy on `/app/strategies` is
inert: the user delegated voting power but no one ever votes on their
behalf. Run this and the strategy actually delivers what the dashboard
copy promises.

---

## Quick start

```bash
# 1. Copy the env template and drop in the keeper EOA's private key.
cp packages/keeper/.env.example packages/keeper/.env
$EDITOR packages/keeper/.env       # set KEEPER_PRIVATE_KEY=0x…

# 2. Install deps (workspace-aware).
pnpm install

# 3. Single one-shot run — best for the demo. Submits one vote, exits.
pnpm --filter @mezoyield/keeper once

# 4. OR: long-running cron loop (one tick a day, idempotent).
pnpm --filter @mezoyield/keeper start
```

The deployer EOA from `packages/contracts/.env` is already set as the
optimizer's keeper at deploy time, so the same private key works here.
You can rotate by calling `setKeeper(newAddress)` from the contract
owner.

---

## What the keeper actually does

1. Reads every gauge from `MockGaugeController.gauges()`.
2. For each gauge: reads `gaugeMeta(addr)` (name + total veMEZO weight)
   and `MockMatchbox.bribeForGauge(addr)` (current MUSD bribe pool).
3. Scores each gauge by `bribe / totalVeMezo` (bigint, 1e18-scaled —
   precision-preserving against tiny ratios).
4. Sorts descending; emits weights proportional to score (sum = 10000
   bps, drift fix on the heaviest entry).
5. Submits `castOptimalVote(gauges, weights)` from the keeper EOA.
6. Posts a Discord webhook summary if `DISCORD_WEBHOOK_URL` is set.

The allocation algorithm mirrors `packages/app/lib/optimize.ts`'s
`autoAllocate` — the keeper's vote matches what the user sees on the
dashboard's Set & Forget card.

---

## Why daily cron, not "exactly Sunday"

The Mezo gauge system runs on Unix-aligned 7-day epochs (`floor(now /
604_800)`). The actual boundary lands on **Thursdays at 00:00 UTC**
(Jan 1 1970 was a Thursday). Voting twice in one epoch is a no-op for
reward distribution — the gauge controller deduplicates per voter per
epoch.

The keeper schedules **daily** instead of trying to hit the exact
boundary because:

- Daily-with-idempotency self-heals if a single run fails.
- Avoids edge cases around DST, leap seconds, and node restarts.
- Mezo's gauge controller treats repeat votes within an epoch as a
  no-op for distribution purposes — only the latest weights count.

For a future production-grade bot you'd compute the next boundary via
`Math.ceil(now / 604_800) * 604_800` and schedule a single timer.

---

## Operational notes

- **Centralization point**: whoever holds `KEEPER_PRIVATE_KEY` can
  pick any allocation. For the hackathon this is acceptable; for prod,
  swap for a multisig or DAO-controlled keeper via `setKeeper()`.
- **Funds**: the keeper EOA only needs tBTC for gas. The optimizer is
  non-custodial — no user money flows through this bot.
- **Logging**: pino + pino-pretty. Pipe to a file for archival; the
  per-vote summaries also fan out via the Discord webhook if set.
- **Recovery**: if a tick fails, the daily cron auto-retries. Check
  recent logs and `castOptimalVote` event history on the explorer.

---

## Development

```bash
pnpm --filter @mezoyield/keeper dev      # tsx watch mode
pnpm --filter @mezoyield/keeper lint     # tsc --noEmit
pnpm --filter @mezoyield/keeper build    # tsc emit (dist/)
```
