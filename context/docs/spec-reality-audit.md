# Spec ↔ reality audit

_Captured 2026-05-22, after v3 deploy on Mezo Mainnet._

## Why this exists

The PRD, architecture, and story BDDs were written 1–3 weeks before the v3 deploy. Some claims aged badly when we got hands-on with Mezo's actual on-chain shape — `BoostVoter`'s permission model, `veMEZO` lock semantics, the keeper's gas-estimation behavior under `try`/`catch`. This file is the surgical reconciliation: every load-bearing claim from the spec docs, what it actually is in the deployed code, and what we did about the gap.

Doing this prevents two failure modes:

1. **Future agents re-discovering the same drift.** Without this, the next pass at `useActivateStrategy` or the keeper's gas helper would re-derive the same lessons from scratch by re-reading the postmortems scattered across commits.
2. **Demo-day surprises.** Judges may ask "your PRD says X, your code does Y — explain." This file is the authoritative answer.

Not in scope: spec rewrites. We leave the original spec docs alone (they're a historical record of intent) and add this overlay. If a claim is materially wrong AND load-bearing, we update both. Otherwise, this doc carries the delta.

## Methodology

Two parallel Explore agents (transcribed in `~/.claude/projects/-Users-abu-dev-hackathon-mezo-hack/`) read the spec docs and the current code in full. I pressure-tested their findings against:

- Live mainnet contract state (`scripts/verify-mainnet-state.ts`)
- Live testnet integration (`scripts/verify-testnet-flow.ts`)
- Tigris source + deployments (`context/refs/repos/tigris/`)
- MUSD source (Mezo's own stablecoin protocol — referenced for testnet patterns)
- Mezo BoostVoter ABI + storage (probed directly via RPC at the implementation `0xA696Dc56…`)

Severity rubric:

- **HIGH** — affects mainnet correctness or judge-facing UX; must reconcile before demo.
- **MEDIUM** — accurate intent, sloppy execution; document the drift, ship.
- **LOW** — cosmetic, doc only; can defer.

## Findings

### Architectural & contract layer

| Spec claim (file:line) | Reality | Severity | Resolution |
|---|---|---|---|
| `architecture.md:74-99` declares `MezoYieldOptimizer` with a single `castOptimalVote(gauges, weights)` that "submits a vote on behalf of the user's delegated veMEZO." | The signature is intact, but v3 changed the *semantics*: now iterates `_delegatedUsers[]` and calls `adapter.voteForUser(user, gauges, weights)` per user, with `try`/`catch` skipping failing users. One on-chain tx, N inner calls, one summary `VoteCast` event when ≥1 user succeeds. | HIGH | **Code stays; doc updated.** Added ADR-5 to `architecture.md` capturing the per-user fan-out reason. The original interface declaration in `architecture.md:74-99` is fine — it's the interface that was implemented; the iteration body is implementation detail and not a spec contract. |
| `architecture.md` originally implied `IGaugeController` is directly the real Mezo gauge controller. | Both testnet (`MockGaugeController`) and mainnet (`BoostVoterAdapter`) implement `IGaugeController`; the concrete contract at the slot differs by network. | HIGH | **Doc updated.** New "Contract dependency wiring — testnet vs mainnet" section in `architecture.md` with side-by-side diagram and behavioral table. `test/InterfaceConformance.test.ts` enforces selector parity in CI. |
| Multiple specs refer to "veMEZO delegation" as the wedge. | veMEZO **only exists on mainnet** (`0xb90fdAd3…0122`). Testnet has Tigris's `VeBTC` (`0xB63fcCd…9231`) + `VeBTCVoter` (`0x72F8dd7…5738`) with 4 real registered gauges, but no veMEZO. | MEDIUM | **Code stays.** Testnet uses mocks (MockVeMezo) for shape compat; mainnet uses real veMEZO via VeMezoVotingPower shim. Disclosed in `TESTNET_ADDRESSES.md` with the trade-off analysis vs. pivoting testnet to VeBTC. |
| Mainnet manifest's 5 "Mezo Gauge 0..4" addresses inherited from MockGaugeController's deterministic-keccak scheme. | These are NOT mock addresses on mainnet — they coincidentally are real registered gauges on the live BoostVoter (`isGauge=true` confirmed via `scripts/probe-boostvoter.ts`). Path was luck, not verification. | MEDIUM | **Code stays; doc updated.** `TESTNET_ADDRESSES.md#testnet-vs-mainnet-wiring-delta` explains. Long-term we should swap to documented Mezo gauge addresses; not a demo blocker. |
| Original `BoostVoterAdapter.voteForGaugeWeights` was wired into the optimizer's call path. | That path was the v1/v2 bug — the optimizer-as-msg.sender holds no NFTs, so it always reverted with `CallerHasNoVeMezo`. v3 introduces `voteForUser(voter, …)` gated by `onlyOptimizer` and kept `voteForGaugeWeights` for direct user use. | HIGH | **Code fixed (v3 deploy).** Documented in `MezoYieldOptimizer.sol` ADR comments and `architecture.md` ADR-5. |

### Eligibility, gas, and operational

| Spec claim | Reality | Severity | Resolution |
|---|---|---|---|
| Spec implied `delegate()` is open to any address. | v3 added an eligibility check: `IVeMezoBalance(veMezo).balanceOf(msg.sender) > 0` (Codex P2 round 1) — without it, a malicious actor could spam the `_delegatedUsers[]` array and DoS the keeper's per-tick iteration. | MEDIUM | **Code stays.** New error `NotEligibleToDelegate` documented inline; tests cover it (`test/MezoYieldOptimizer.test.ts`). The dApp's activate flow should detect `balanceOf === 0n` and surface a "Lock MEZO first" CTA — partial today, finish in a follow-up if time allows. |
| Keeper docs say `castOptimalVote` is callable straightforwardly. | Per-user iteration with `try`/`catch` blinds viem's `estimateGas` (it sees the outer succeed even when the inner per-user call OOGs). The keeper must send explicit `gas: 100k + 200k * delegatedUsersCount` headroom or every tick silently fails into `VoteSkipped` events. Concrete proof: testnet tx `0x4cfd33e0…2bdf` debug trace. | HIGH | **Code fixed.** `packages/keeper/src/keeperGasLimit.ts` carries the formula + the postmortem in the file header. `runOnce.ts` reads `delegatedUsersCount` before each submit. |
| PRD mentions "Mainnet deploy is intentionally deferred until Mezo publishes the real gauge / matchbox addresses." | Mainnet is now deployed (v3 at `0x3e05a2…2068`). Mezo's gauge/matchbox addresses are known + wired via adapters. | MEDIUM | **Doc updated.** `TESTNET_ADDRESSES.md` rewritten with both networks' addresses; "Mainnet readiness" section deleted. |
| Spec assumes one canonical mainnet deploy. | There were three half-finished deployment passes before v3: two abandoned Optimizers (`0xFe5C342…dEb75` v1, `0x4768823…4AF5` matchbox v2). The user's only prior `delegate()` (tx nonce 11 on the keeper EOA) landed on v1, NOT the current v2 in the manifest — which is why the dApp showed zero state during the original incident. | LOW | **Code stays.** Cleaned up: v3 redeploy script is the single canonical entry. Old scripts deleted in the same PR. v1/v2 contracts remain on-chain but unreferenced; user re-delegates to v3 fresh. |

### Frontend & UX

| Spec claim | Reality | Severity | Resolution |
|---|---|---|---|
| `ux-spec.md` implies a single-click "activate" flow. | Activate is multi-step: faucet (testnet only) → delegate → approve (mainnet only) → vote. Each step is a separate wallet signature. | MEDIUM | **Code + UX updated.** `useActivateStrategy` exposes `currentStep`; `StrategyDetailModal` now renders a pulse-dot step indicator. User sees what step they're on instead of "Confirm in wallet…" with no context. |
| `useGaugeData` framed as primary read path. | Today reads from `BoostVoterAdapter.gauges()` — our 5 registered gauges, not the upstream BoostVoter's 594. The dApp shows the same 5 we curate, by design (the adapter's registry is the dApp's view). | LOW | **Code stays.** Documented in `BoostVoterAdapter.sol` NatSpec: registry is owner-managed because BoostVoter has no length getter and iteration risks unbounded gas. |
| Spec assumed `useLastVote` walks back the entire chain quickly. | The hook walks 120 × 9999-block chunks backward. With v1/v2 having zero events, it walked the full window before returning `undefined` — manifesting as the "stuck loading" symptom that triggered this whole investigation. | MEDIUM | **Code stays (workaround), root cause fixed.** After v3 + ops steps, VoteCast events exist; the hook finds them on chunk 0. A future PR could collapse to a single `getLogs` call from `OPTIMIZER_DEPLOYMENT_BLOCK` when the range fits; not demo-critical. |
| Spec didn't mention optimistic state updates. | Pre-v3 claim flow had a 12-second blank window on mainnet while the receipt landed before refetch. v3 writes `pendingWei = 0n` to the query cache the instant the user broadcasts. | LOW | **Code added.** No spec change needed — this is implementation polish under the existing "good UX" framing. |
| Spec didn't mention live-ticking timestamps. | Pre-v3 "X ago" labels were static per page load. v3 adds `useLiveRelativeTime` + keeper heartbeat chip on dashboard. | LOW | **Code added.** Same as above — polish, not a spec gap. |

### Testnet/mainnet pattern (the user's main concern)

| Spec claim | Reality | Severity | Resolution |
|---|---|---|---|
| Spec implicitly framed testnet and mainnet as architecturally interchangeable. | They're not — testnet uses `MockGaugeController` directly; mainnet uses `BoostVoterAdapter` wrapping real `BoostVoter`. Same `IGaugeController` interface, different *behavioral contract* (NFT check, approval requirement, gas profile). | HIGH | **Doc updated.** Considered (and explicitly rejected, per Explore audit and industry research on MUSD's NoOp pattern) a full testnet rebuild for parity. Instead: explicit divergence doc (`TESTNET_ADDRESSES.md#testnet-vs-mainnet-wiring-delta`), behavioral consequences table, interface conformance test, NatSpec at the wiring slot. Pattern aligns with MUSD's published Sepolia disclosure. |
| Hackathon brief mentions "deploy a working demo on Mezo testnet" (PRD:50). | ✅ Working on testnet end-to-end (proven by `scripts/verify-testnet-flow.ts`: VoteCast emitted, 0 VoteSkipped, gauge controller records per-user voter). | NONE | No action. |
| Hackathon brief frames veMEZO/MUSD integration as required. | ✅ veMEZO integration is real on mainnet (eligibility gate + adapter forwarding NFT-keyed votes). MUSD integration is real on both (MatchboxAdapter's MUSD reward token wired). | NONE | No action. |

## What surprised us

- **MUSD itself uses NoOp stubs on Sepolia** with a "before the bridge is implemented" comment. Pattern-defensible; we're not in worse company than Mezo's own stablecoin team.
- **Tigris does the opposite** — full parity with real contracts on both networks. Two contradictory precedents from Mezo's ecosystem; the right answer depends on the project's complexity and whether the testnet upstream contracts exist (veBTC: yes; veMEZO: no).
- **The 5 manifest gauges turned out to be real.** Initially I thought they were MockGaugeController placeholders that would revert at the real BoostVoter. They're not — `isGauge=true` on all 5. Lucky.
- **Gas on Mezo is dirt cheap.** The whole v3 mainnet deploy cost $0.50 from a $13 balance, including all 4 contract txs. The user's perception of "expensive" came from comparing to ETH mainnet.

## Open follow-ups (post-demo)

- Document an opinionated "veMEZO acquisition" UX in the dApp (today: external link to Tigris; could embed a `createLock` flow directly).
- Collapse `useLastVote` to a single `getLogs` window when `head - deployBlock <= CHUNK_SIZE`.
- Add a `castOptimalVoteFor(address[] subset)` paginated overload to Optimizer if `_delegatedUsers[]` ever grows past ~50 entries.
- Audit the `<claude-mem-context>` autoinjection in `AGENTS.md` / `packages/contracts/AGENTS.md` (Codex round 2 P2) — keeps regenerating despite removals.
- Phase 2 of testnet parity (if Mezo deploys veMEZO + BoostVoter on testnet): switch the dApp's testnet path to use the real contracts via the same adapter, retire MockGaugeController in deploys.
