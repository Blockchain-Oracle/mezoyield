# PRD — MezoYield
**Hackathon:** Mezo Hack: Building Bitcoin's Future (Encode Club)  
**Track:** MEZO Track  
**Deadline:** May 25, 2026  
**Version:** 1.0 — 2026-04-30

---

## Problem

veMEZO holders must manually vote gauges every week to earn rewards. Most skip it. When they do vote, they guess — they have no visibility into which gauges offer the best incentives, and no way to auto-compound. Boar Finance partially solves this for veBTC, but there is no tool that:
- shows you where to vote to maximize yield
- auto-executes the optimal vote allocation each epoch
- surfaces rewards in MUSD terms so users understand what they're actually earning

The judges (and Andre at Supernormal) named this gap explicitly in workshop transcripts: *"we currently don't have anything that is like simple way of getting yield on mezo token today."*

---

## Solution — MezoYield

**One sentence:** Set your MEZO yield on autopilot — connect wallet, choose a strategy, and MezoYield auto-votes your gauges and shows your rewards in MUSD.

**Core features (MVP):**
1. **Dashboard** — live veMEZO position, gauge APYs from Matchbox, epoch countdown, expected rewards in MUSD
2. **Auto-vote** — delegate voting power to MezoYield's optimizer; it selects the highest-incentive gauges each epoch
3. **Manual override** — user can pin allocation to specific gauges
4. **Claim rewards** — single-click claim of accumulated MUSD rewards
5. **History** — per-epoch yield chart showing MUSD earned over time

**What it is not:** a new protocol, a custodial vault, or a fork of Boar. MezoYield is a non-custodial optimizer + analytics layer that sits on top of the existing Mezo gauge system.

---

## Demo moment

Judge opens the app. Connects via Mezo Passport. Sees their veMEZO position and current gauge allocations side-by-side with the live Matchbox bribe board. Clicks "Auto-optimize." A confirmation modal shows the optimal allocation. Confirms. Transaction goes through. Dashboard updates — expected yield now shown in MUSD/epoch. Judge can also see historical MUSD earnings chart from prior epochs.

*No jargon. No manual calculation. No weekly chore.*

---

## Judging fit

| Judging criterion | How MezoYield hits it |
|---|---|
| Integrates MUSD | Rewards surfaced in MUSD; claim outputs MUSD |
| Integrates MEZO | veMEZO is the core asset optimized |
| Uses Mezo Passport | Wallet connection via Passport (mandatory) |
| Working demo on testnet | Full deploy on Mezo Testnet (Chain ID 31611) |
| New utility for MEZO | First analytics + optimizer UI for the gauge system |
| Judge signal (Andre) | Directly answers the "simple MEZO yield" gap he named |
| Differentiates from prior winners | 2025 had zero MEZO track tools — this is structurally new |

---

## Out of scope (MVP)

- Custodial vaults (no protocol holding user funds)
- Bribe posting (marketplace, not creator)
- Mobile app
- Cross-chain MUSD routing (use in v2)
- veBTC optimization (Boar does this; MezoYield focuses on veMEZO)
