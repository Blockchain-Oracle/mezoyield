# MezoYield — Manual Test Plan (V2)

_Last updated: 2026-05-04. For the V2 redesign on `feat/v2-redesign`._

This is the human checklist for "did we ship a working product." It runs
on top of the automated suite (which proves the contract bytecode works
on the deployed testnet) by verifying the user-facing flows in the
actual UI with a real wallet.

If you change a hot-path file (any `packages/app/lib/`, `hooks/`, or
`features/strategies/`), or you ship a new contract, run this plan
before opening a PR.

## What is already automated

You don't have to test these by hand — the suites prove them already.

- **Read-only on-chain surface**
  `packages/contracts/test/integration/testnet-readiness.test.ts` —
  manifest schema + on-chain wiring + seeded gauge / matchbox state.
  Run with `RUN_TESTNET_INTEGRATION=1`.

- **Write-flow proof of functionality**
  `packages/contracts/test/integration/proof-of-functionality.test.ts`
  — sends real txs to chain 31611:
  - `delegate(self)` flips `isDelegated` and emits `Delegated`
  - `setManualAllocation` persists + round-trips via `getAllocation`
  - `castOptimalVote` (keeper-only) emits `VoteCast` with the right
    payload
  - Backwards-walking log query (the same one `useLastVote` uses on
    the landing) finds the most recent `VoteCast`
  - `MockMatchbox.bribeForGauge` answers for every seeded gauge
  Run with `RUN_TESTNET_INTEGRATION=1 RUN_TESTNET_WRITES=1`.

- **Frontend unit + hook tests**
  86 vitest cases across `packages/app/__tests__/` cover the pure
  algorithms (`autoAllocate`, `estimateWeeklyMusdWei`, autocompound
  splitter), strategy preset shapes, the activate hook's tx
  sequencing, the wallet-ready gate, and the providers stack.
  Run with `pnpm --filter @mezoyield/app test`.

If any of these fail, **STOP** the manual plan and fix them first.

---

## Manual end-to-end walkthrough

Prereqs:
- A funded testnet wallet (faucet at `https://faucet.test.mezo.org`)
- Chain 31611 added to your wallet (the Connect button auto-prompts
  the switch, but verifying it manually first is safer)
- Dev server running: `pnpm dev` from `packages/app`

### Path 1 — landing page renders real on-chain proof

1. Visit `http://localhost:3000/`
2. Verify Hero loads, the Ticker scrolls real numbers (not zeros)
3. Scroll to **Proof of execution** — it must show:
   - A real tx hash from the optimizer (`0x…`) with explorer link
   - A block number (8-digit) and a "Xm/h ago" timestamp
   - A gauge name from the seeded set ("Stability Pool", "MUSD
     Savings Rate", or "BTC-MUSD LP")
   - A weight % (any value between 1% and 100%)
   - "Set & Forget" as the strategy fingerprint
4. Click the tx hash → opens
   `https://explorer.test.mezo.org/tx/0x…`. Verify the destination
   address matches the optimizer in the manifest
   (`0x1A9a4f8279F88a1551117766957DB23A35133B6D`).
5. Scroll to **Comparison**, **LiveDataStrip**, **FeatureGrid**,
   **Footer** — all should render without console errors.

**If ProofLedger shows "Awaiting first keeper transaction":** run
`pnpm --filter @mezoyield/keeper run once` to fire one. Refresh the
page. The new tx should appear within ~10s of confirmation.

### Path 2 — Set & Forget activation

1. Visit `/app/strategies`. Click **Activate** on the Set & Forget
   card.
2. Verify the modal shows:
   - "ALLOCATION · RE-BALANCED EACH EPOCH"
   - 3 named gauges with non-zero weights summing to 100%
   - "Your projected reward" line (will be `— MUSD/wk` when
     disconnected; should compute a positive number after connect)
3. Connect a wallet (Mezo Passport modal → MetaMask / injected
   wallet). Re-open the Set & Forget modal.
4. Verify the projection is now non-zero.
5. Click **Delegate & activate**. Wallet popup → confirm. Wait for
   "Settling on chain…" → "Activated ✓".
6. Note the tx hash, click "View transaction" link → opens explorer.
7. Visit `/app/vault`. Verify "Delegation status" card shows you as
   delegated.

### Path 3 — claim path

1. With a delegated wallet that has seeded `pending` MUSD on the
   Matchbox (the deployer wallet has 25 MUSD by default per the
   manifest), visit `/app/dashboard`.
2. Click **Claim MUSD**.
3. Confirm wallet popup → wait for receipt.
4. Verify:
   - `pending` returns to 0 on the next read
   - "Recent earnings" chart on `/app/vault` shows a new bar in the
     current epoch
   - The optimizer emitted `RewardsClaimed(user, amount)` (visible
     on the explorer at the tx)

### Path 4 — the keeper actually fires

1. From repo root: `pnpm --filter @mezoyield/keeper run once`
2. Watch the log — should print:
   - `loading live gauge state`
   - `computed optimal allocation` with a breakdown
   - `submitting castOptimalVote…`
   - `submitted; waiting for receipt`
   - `confirmed` with `status: 1`
3. Re-load `http://localhost:3000/`. The ProofLedger tx hash should
   match the keeper's run and "Xm ago" should read `< 1m`.

### Path 5 — read-only browse

For each route:
- `/app/dashboard` — position summary, epoch countdown,
  next-action card
- `/app/strategies` — 6 cards (Set & Forget recommended, 4 manual
  presets, Custom disabled with "Coming next")
- `/app/gauges` — table of 3 seeded gauges with APY computed from
  `(bribe / totalVeMezo) * 52`
- `/app/vault` — delegation status, active strategy, vote history,
  earnings chart
- `/app/leaderboard` — top users by claimed MUSD (seed deployer
  should appear with their claimed total)
- `/app/bribe-market` — Matchbox bribes per gauge
- `/app/settings` — auto-compound %, gas-fee boost (badge: "Coming
  next"), notification email (badge: not yet delivered)

Verify no route renders blank or with a runtime error.

---

## What to check when the failure mode is "looks weird"

- **Gas-fee boost slider has no effect on tx fees**: expected — it's
  saved as a preference now; the wiring into wagmi's `maxFeePerGas`
  / `maxPriorityFeePerGas` is a follow-up commit. The "Coming next"
  badge is in place.
- **Notification email field doesn't send anything**: same — the
  field stores the email, but the keeper bot's notifier currently
  only writes to the optional Discord webhook. Email delivery is
  follow-up.
- **Custom strategy is disabled**: expected. The slider editor for
  manual gauge weights ships with the strategies-v2 polish PR.
- **Set & Forget projection on landing is "—"**: expected if you're
  disconnected. Connect a wallet with a non-zero veMEZO balance.
- **Vault "Recent earnings" chart shows no bars**: expected if your
  wallet has never claimed. Click "Faucet" on `/app/dashboard`
  (deployer-only) or wait for a real claim.

---

## Mainnet readiness checklist

This is what changes when we move to mainnet (currently on testnet
chain 31611). Don't blanket-promote — every line below is a deliberate
risk decision.

- [ ] Replace `MockGaugeController` with the real Mezo `Voter.sol`
      (Solidly fork at `mezo-org/tigris`). Add a Tigris adapter in
      `lib/contracts.ts` that detects which gauge controller is live.
- [ ] Replace `MockMatchbox` with the real Matchbox bribe market
      contract (whichever address Mezo publishes; CONTEXT.md OQ #6).
- [ ] Audit `MezoYieldOptimizer.sol`. The MVP has no reentrancy
      guard on `claimRewards` because the Matchbox is trusted in
      mock; on mainnet, harden with `nonReentrant`.
- [ ] Move keeper from a single EOA to a multi-sig OR a Gelato
      automation (so a stolen keeper key doesn't grief users).
- [ ] Configure WalletConnect with a real `projectId` (currently
      uses dev placeholder; throws in production builds).
- [ ] Wire the gas-fee boost setting into the wagmi write paths.
- [ ] Wire notification email delivery (likely via Resend or
      Postmark).
- [ ] Run the proof-of-functionality suite against the new
      mainnet manifest.
- [ ] Get a third-party audit on the optimizer + the keeper bot.
- [ ] Add a circuit-breaker `pause()` on the optimizer for
      emergency response.
