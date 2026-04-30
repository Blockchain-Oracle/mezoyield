# CLAUDE.md — MezoYield

_Updated: 2026-05-01. Managed by sahil-coding-protocol._

## What this is

MezoYield is an automated yield optimizer for the Mezo protocol — a "Convex for Mezo". Users deposit veMEZO and/or veBTC NFTs into a vault, which auto-votes every epoch to maximize BTC yield, claims rewards, and displays earnings in MUSD terms. Built for Mezo Hack: Building Bitcoin's Future (Encode Club). Deadline: May 25, 2026.

## Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Contracts:** Solidity 0.8.28, Hardhat (EVM-compatible — NOT Solana)
- **Chain:** Mezo testnet (Chain ID 31611, RPC: https://rpc.test.mezo.org)
- **Wallet:** @mezo-org/passport (RainbowKit wrapper — supports Xverse, Unisat + EVM wallets)
- **Package manager:** pnpm 10.33.0 (monorepo: packages/app + packages/contracts)
- **Testing:** Vitest (app), Hardhat tests (contracts)
- **Indexing:** Goldsky subgraph (for gauge APY data)
- **Deploy target:** Mezo testnet (contracts), Vercel (frontend)

## Top-3 commands

```bash
.claude/scripts/green-light.sh   # full gate: tests + lint + types + §14 grep
pnpm dev                          # Next.js dev server
pnpm test                         # Vitest (app) + Hardhat (contracts)
```

## Library research rule (mandatory)

Before implementing ANYTHING from scratch, check Context7 first:

```bash
mcp__context7__resolve-library-id libraryName="<what you need>"
mcp__context7__query-docs context7CompatibleLibraryID="<id>" topic="<specific area>" tokens=5000
```

**If a library exists that solves it, use it. Do not build it yourself.**

## Required external libraries (use these, do not reinvent)

| Library | Purpose | How to add |
|---|---|---|
| `@mezo-org/passport` | Wallet connect (Bitcoin + EVM) — MANDATORY | `pnpm add @mezo-org/passport` |
| `viem` | EVM client, contract reads/writes | `pnpm add viem` |
| `wagmi` | React wallet hooks | `pnpm add wagmi` |
| `zustand` | Global state (wallet, votes, positions) | `pnpm add zustand` |
| `zod` | Schema validation | `pnpm add zod` |
| `ethers` | Fallback for Hardhat scripts | already in Hardhat devDeps |

**Do NOT use** `@solana/web3.js`, `@web3-react/core` — Mezo is EVM, not Solana.

## Context repos (read before implementing)

Cloned locally. Read these before writing gauge voting or contract code.

```
research/mezo-2026/refs/repos/musd/          — mezo-org/musd: full MUSD + gauge contracts (Solidity 0.8.28)
                                                Read: solidity/contracts/Governance*.sol for voting mechanics
```

Key patterns from musd:
- Gauge voting contract: how veBTC/veMEZO votes are recorded per epoch
- MUSD minting: collateral → MUSD flow (mandatory integration)
- Reward distribution: how BTC yield is claimed per epoch

## Rules for this repo

- **Mezo is EVM** — use viem/wagmi, NOT Solana web3.js
- Mezo Passport is **mandatory** for wallet connection (RainbowKit wrapper)
- MUSD integration is **mandatory** — yield must be displayable in MUSD terms
- All contract calls hit real Mezo testnet (Chain ID 31611) — no mocks in hot path
- `§14 grep gate` must be clean: no mock/fake/dummy/hardcoded contract data
- Contract addresses go in `.env.local` — never hardcoded
- pnpm workspace only — never `npm install` or `yarn`

## pnpm workspace setup

```bash
pnpm install --frozen-lockfile
pnpm dev       # starts Next.js
pnpm build     # builds all packages
pnpm test      # runs all tests
pnpm lint      # lints all packages
```

All `package.json` files (root + workspace packages) must include `"packageManager": "pnpm@10.33.0"`.

## BDD acceptance criteria

For each story:
1. Read `SPEC.md` at repo root (3-field brief)
2. Read full story file: `research/mezo-2026/docs/stories/story-<slug>.md`
3. Write tests FIRST (ATDD), implement until `pnpm test` passes
4. Check `.claude/last-review.json` after every UI edit

## Anchor products

- **Votium** (https://votium.app) — reference for vote discovery + gauge APY display
- **Convex Finance** (https://www.convexfinance.com) — reference for vault deposit + compound flow
- Anchor screenshots: `screenshots/anchor/` — immutable, never overwrite

## Known pitfalls

- Mezo is EVM (Chain ID 31611) — not Solana. Do not use Solana libraries.
- CI requires `packageManager` field in ALL package.json files (root + each workspace package)
- `enforce_admins: true` — all changes go through PRs, even admin token commits

## Where things live

- **SPEC.md:** `SPEC.md` at repo root — read this FIRST for every task
- **Story files:** `research/mezo-2026/docs/stories/story-<slug>.md`
- **Architecture + PRD:** `research/mezo-2026/docs/architecture.md` + `docs/PRD.md`
- **Context repos:** `research/mezo-2026/refs/repos/` (musd gauge contracts)
- **Anchor screenshots:** `screenshots/anchor/`
- **Reviewer output:** `.claude/last-review.json`
- **Green-light log:** `.claude/green-light.log`

## CI requirement

CI must stay green on every commit. If CI is red: stop, fix, re-run green-light.sh, then continue. Never merge a PR while CI is red.