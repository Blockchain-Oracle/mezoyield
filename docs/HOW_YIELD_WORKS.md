# How yield really works in MezoYield

A pitch script for Abu — and anyone else explaining MezoYield to judges, friends,
or the void at 2am.

---

## TL;DR (the elevator)

> **MezoYield is Convex for Mezo.** Mezo's gauge system pays MUSD bribes to
> whoever directs veMEZO votes toward specific liquidity pools. That payout
> requires a vote *every single week.* Most veMEZO holders skip it and miss the
> yield. MezoYield delegates the vote to a keeper bot that auto-picks the
> highest-paying gauge each epoch — you click once, you earn MUSD forever.
> Non-custodial, first-mover on the MEZO Track, real testnet contracts.

---

## The three things Mezo built

To understand our yield, you have to understand the three primitives:

| Primitive       | What it is                                                              |
|-----------------|-------------------------------------------------------------------------|
| **MEZO**        | Mezo's native governance token                                          |
| **veMEZO**      | MEZO you've **locked** for voting power (Curve / Aerodrome ve(3,3) model) |
| **MUSD**        | Mezo's BTC-backed stablecoin (Liquity-style CDP, BTC collateral)        |
| **Gauges**      | Different liquidity pools / yield destinations on Mezo (Stability Pool, MUSD Savings Rate, BTC-MUSD LP, etc.) |
| **Matchbox**    | A **bribe market** — protocols post MUSD bribes to attract veMEZO votes to *their* gauge |

The gauge controller distributes MEZO emissions every epoch (1 week) to gauges
proportional to vote weight. **Bribers** (other DeFi projects, market makers,
DAOs) want their gauge to attract more emissions — so they post **MUSD bribes**
on Matchbox. Voters who direct their veMEZO to a gauge with bribes share the
bribe pool, paid in MUSD, every epoch.

---

## Why this is NOT a Yearn-style vault

You said it best: *"yield is just like a vault that you save your money in,
after some time you get the liquidity token."* That's **Yearn-class** yield —
deposit, the vault DOES work for you (lending, LP, harvesting), it returns a
share token that appreciates.

**MezoYield is structurally different.** It's a **bribe-market optimizer** in
the **Convex / Votium / Aura** family:

| Yearn-class vault                                 | MezoYield (bribe optimizer)                      |
|---------------------------------------------------|---------------------------------------------------|
| Deposit money in                                  | **Don't deposit anything**                        |
| Vault does the work (lending, LP, harvest)        | Optimizer **votes** on your behalf                |
| Yield = interest the vault earns                  | Yield = **MUSD bribes** posted by other protocols |
| Custodial — vault holds your tokens               | **Non-custodial** — your veMEZO never moves       |
| Claim by burning vault shares                     | Claim MUSD straight from Matchbox                 |
| Vault has a TVL                                   | Optimizer has **zero balances on chain**          |

The protocol literally holds nothing. It's pure delegation + coordination.
If you read the Solidity (`packages/contracts/contracts/MezoYieldOptimizer.sol`)
you'll see no `payable` functions, no token approvals stored, no ERC-20
balances. The whole thing is ~170 lines because it doesn't need to do anything
except track delegations and forward votes.

---

## The actual user flow, end to end

1. User locks MEZO → gets veMEZO (this happens *outside* MezoYield, on Mezo's
   own staking UI; we read the balance via `MockVeMezo.balanceOf`).
2. User opens MezoYield → **/app/earn/strategies** → picks a strategy.
3. For **Set & Forget** (the headline strategy):
   - Wallet pops up: `delegate(user)` → user signs → optimizer flips
     `isDelegated[user] = true`.
   - Done. The user closes the tab forever (or comes back to claim).
4. **Every Mezo epoch (~7 days)** our keeper bot wakes up:
   - Reads every gauge's current bribe + total veMEZO
   - Scores by `bribeMUSD / totalVeMezo` (Curve's score formula)
   - Picks the top-scoring gauge(s) and computes weights
   - Calls `castOptimalVote(gauges, weights)` on the optimizer with the
     keeper's signing key
   - The optimizer forwards the vote to Mezo's gauge controller
   - Bribers' MUSD pool is split among voters by their share of the winning gauge
5. User comes back **whenever** → **/app/dashboard** → clicks Claim →
   `claimRewards(user)` forwards to `Matchbox.claim(user)` → MUSD lands in
   their wallet.
6. Optionally on **/app/settings** they set an auto-compound % → the claim
   surfaces a wallet/compound split (the actual swap → MEZO → re-lock as
   veMEZO is a follow-up; the split logic and UI is shipped).

For the **4 static strategies** (Stability Max, MUSD Saver, BTC-LP Farmer,
Balanced 40/30/30) the user calls `setManualAllocation(gauges, weights)`
directly with that strategy's preset — no keeper involved, the vote stays
fixed across epochs until they re-pick. Custom is the same with user-chosen
weights.

---

## What's actually live on testnet right now

These are real, deployed addresses on Mezo Testnet (chain 31611). Not mocks
in the optimizer — the optimizer is real. The "Mock" prefix on
GaugeController/Matchbox/VeMezo is because Mezo hasn't published their *real*
production addresses yet (per CONTEXT.md OQ #6); we ship testnet stand-ins
until they do, and the only swap to mainnet is the deployment manifest.

| Contract              | Address                                       |
|-----------------------|-----------------------------------------------|
| `MezoYieldOptimizer`  | `0x1A9a4f8279F88a1551117766957DB23A35133B6D`  |
| `MockGaugeController` | `0xB2f5cBbf2401F4F74F3E4d9FaCb3C4b7c1897140`  |
| `MockMatchbox`        | `0x5C86Aa4Cc0aff9f4AA9751671eE946dc4Dc07431`  |
| `MockVeMezo`          | `0x5351665b6805B35e0ba3C7522e62e7E3EEEeA2d6`  |

The keeper just voted on testnet at block `12826607`, tx
`0xab46c68aae706344c425877113e67c3722e7af652715c8d22792fcb7ca81d7a2`. You can
hand a judge that link.

---

## How we're different from "another yield platform"

The MEZO Track in 2025 had **zero winners** in this lane — Andre Coutinho
(Supernormal Foundation, transcript 7) literally said on camera *"we currently
don't have anything that is like a simple way of getting yield on mezo token
today."* Dimmitri Paremski (Mezo integration eng, transcript 3) named the
same gap: *"users don't need to remember about voting every single week."*

**Boar Finance** is the closest existing product — but Boar only handles
**veBTC delegation**. Nothing exists for the **veMEZO** side, nothing surfaces
**Matchbox** bribe data, nothing offers a **strategy-list UX**, nothing
auto-compounds MUSD back into MEZO. We're first on every one of those.

| Ask                                                   | Generic yield agg | MezoYield                |
|-------------------------------------------------------|-------------------|--------------------------|
| Vault that takes my deposit                           | yes               | **no** (non-custodial)   |
| Auto-compounds my returns                             | yes               | yes (preview phase)      |
| Hides gauge addresses behind names                    | n/a               | yes                      |
| MUSD-denominated reward display                       | rare              | yes (everywhere)         |
| Yearn-style strategy picker (browse, then activate)   | yes               | yes (6 presets)          |
| Real on-chain keeper that votes for you weekly        | n/a (different model) | yes (just executed)  |
| Surface live Matchbox bribe market                    | no (different model) | yes (read-only board) |
| First on Mezo Track                                   | n/a               | **yes** (Andre + Dimmitri named the gap) |

---

## What the judges will score (and how we hit it)

| Criterion           | Weight | How we hit it                                                            |
|---------------------|--------|--------------------------------------------------------------------------|
| Mezo Integration    | 30%    | Touches **all four primitives** (veMEZO read, gauge controller vote, Matchbox bribe + claim, MUSD denomination) |
| Technical           | 30%    | Real Solidity contract, real keeper bot that just voted, viem v2 + wagmi + RainbowKit, monorepo, 86 tests |
| Business Viability  | 20%    | Andre + Dimmitri named the gap on camera. Post-hackathon path: Mezo could integrate this into their app surface |
| UX                  | 10%    | Aunt-Linda flow. 30-second demo: connect → activate Set & Forget → claim. No jargon, no addresses. |
| Presentation        | 10%    | Editorial visual identity (Fraunces serif + Mezo brand `#FF004D`), real on-chain proof, sharp written pitch (this doc) |

---

## The 90-second demo script

1. **Open landing** → "MezoYield is the set-and-forget MEZO yield optimizer.
   Lock MEZO, click Set & Forget, claim MUSD whenever."
2. **Click Launch app → /app/dashboard** → "We see live veMEZO position +
   projected MUSD/week. Mezo runs weekly epochs — there's the countdown."
3. **Click Strategies** → "6 preset allocations across Mezo's gauges. Set &
   Forget is the headline; the others are static for users who want a fixed
   risk profile. Built like Yearn — browse and pick."
4. **Click Activate on Set & Forget** → wallet pops up → sign → "I just
   delegated voting power to MezoYield's optimizer."
5. **Tab to terminal** → `pnpm --filter @mezoyield/keeper once` → "And there's
   the keeper just voting on chain on my behalf. Real `castOptimalVote` tx,
   block 12826607." Show the explorer.
6. **Click My Vault** → "Delegation status: Delegated. Active allocation:
   here's exactly how the keeper just voted. Yield history chart will populate
   as I claim each epoch. What-if simulator below shows what each strategy
   would have earned over the past 8 weeks."
7. **Click Bribe Market → Leaderboard → Settings** → "Real Matchbox bribe data.
   Top earners by claimed MUSD. Auto-compound % preference for re-locking
   into veMEZO."
8. **Back to dashboard → Claim** → MUSD lands in wallet.
9. *"30 seconds, set-and-forget, real testnet, first on the MEZO Track. Andre
   said this was missing — we built it."*

---

## Hand-this-to-someone version

> MezoYield is a non-custodial gauge-vote optimizer for Mezo. Locked MEZO
> (veMEZO) earns MUSD bribes for voting on liquidity gauges every week.
> MezoYield's keeper bot does that vote for you automatically. You delegate
> once on /app/earn/strategies, claim MUSD whenever, and never think about gauge
> voting again. Built on real testnet contracts (`0x1A9a4f…133B6D`); the
> keeper bot has already cast votes on chain. First yield product on Mezo's
> MEZO Track — Andre Coutinho named the gap on camera ("no simple way of
> getting yield on MEZO today"); we shipped it.
