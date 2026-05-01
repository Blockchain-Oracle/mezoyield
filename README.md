# MezoYield

**Set-and-forget MEZO yield. One CTA. Auto-vote the highest-incentive gauges every epoch — rewards in MUSD.**

Built for Mezo Hack 2026 (Encode Club, MEZO Track).

---

## The problem

Mezo's gauge system rewards veMEZO holders who vote weekly for the gauges that maximize their MUSD yield. The mechanics are powerful but opaque:

- Holders must understand bribes, gauge weights, and basis points.
- They must vote *every week*, or rewards trail off.
- The optimization math (max MUSD/week per veMEZO unit) requires comparing live bribe data across gauges.

[Andre Coutinho (Supernormal Foundation), MEZO Hack transcript]: *"we currently don't have anything that is like a simple way of getting yield on mezo token today."*

## The solution

MezoYield is **the one-click yield CTA for Mezo**:

1. Connect wallet via Mezo Passport (Bitcoin + EVM).
2. See your veMEZO position, the live gauge board, and your epoch countdown.
3. Click **Auto-optimize**: the optimizer ranks gauges by `bribe / totalVeMezo` (annualized), distributes your weights proportionally, and submits a single vote.
4. Claim your MUSD rewards from the same screen. Watch your 8-week yield history populate.

Every screen anchors on **MUSD/week**, not raw veMEZO weights or basis points. Gauge addresses never leak to the UI — only human names. This is yield optimization framed for the user who wants the yield, not the governance dashboard.

## Features

- **Auto strategy** — single CTA, deterministic allocation by APY rank.
- **Manual strategy** — sliders + sum-to-100% gate for power users.
- **Position card** — veMEZO balance, current allocation, "≈ X MUSD/week" hero.
- **Gauge board** — live APY%, weekly bribe, my-weight column. Goldsky subgraph with on-chain RPC fallback.
- **Claim rewards** — single button, `Claim X.XX MUSD`, post-success refetch + history invalidation so the chart reflects the new claim immediately.
- **Yield history** — last 8 epochs as a bar chart, contiguous calendar slots with zero-fill so gaps are visible.
- **Epoch countdown** — sticky D:HH:MM:SS to next epoch, progress bar.

## Live demo

> **Demo URL:** *pending — to be filled in by the repo maintainer once the
> off-Vercel deploy lands. The submission shell (README, addresses, license,
> screenshot procedure) is intentionally landed before the deploy so that the
> README/contracts pair is reviewable on its own. The deploy URL replaces
> this paragraph in a follow-up commit.*
>
> Mezo Testnet only. Get tBTC from [https://faucet.test.mezo.org](https://faucet.test.mezo.org), then connect via the Mezo Passport modal. Until the deploy lands, the live demo is reproducible locally — see "Run locally" below.

## Run locally

```bash
pnpm install
pnpm dev          # Next.js on http://localhost:3000
```

Other useful commands:

```bash
pnpm --filter @mezoyield/contracts test    # Hardhat unit tests + live testnet integration
pnpm --filter @mezoyield/app test          # Vitest UI suites
pnpm test && pnpm lint                     # full local gate
```

## Deployed contracts

Mezo Testnet (chain `31611`). See [TESTNET_ADDRESSES.md](./TESTNET_ADDRESSES.md) for the full table including transaction hashes and deployment block numbers.

| Contract                | Address                                       |
|-------------------------|-----------------------------------------------|
| `MezoYieldOptimizer`    | `0x1A9a4f8279F88a1551117766957DB23A35133B6D`  |
| `MockGaugeController`   | `0xB2f5cBbf2401F4F74F3E4d9FaCb3C4b7c1897140`  |
| `MockMatchbox`          | `0x5C86Aa4Cc0aff9f4AA9751671eE946dc4Dc07431`  |
| `MockVeMezo`            | `0x5351665b6805B35e0ba3C7522e62e7E3EEEeA2d6`  |

The two `Mock*` contracts are testnet stand-ins because Mezo's real gauge controller and Matchbox addresses aren't published as of this writing. The optimizer is non-custodial; swapping these for the real Mezo gauge system (`mezo-org/tigris`'s `Voter.sol`) requires only updating the deployment manifest — no app or contract code changes.

## Architecture

- **Solidity 0.8.28**, Hardhat 2.22. Contracts in `packages/contracts/`.
- **Next.js 14 App Router**, Tailwind v4, shadcn/ui (`base-nova`). App in `packages/app/`.
- **wagmi v2 + viem v2**, `@mezo-org/passport` for wallet integration.
- **Recharts** for the yield-history chart.

The complete dependency tree, anti-slop rules, and review discipline are documented in `CLAUDE.md`. Story-by-story BDD specs live under `context/docs/stories/`.

## License

MIT — see [LICENSE](./LICENSE).
