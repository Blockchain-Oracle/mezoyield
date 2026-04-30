# CLAUDE.md — MezoYield

_Updated: 2026-04-30. Managed by sahil-coding-protocol._

## What this is

MezoYield is a vote optimizer for the Mezo ecosystem. It helps users discover and execute optimal voting strategies on Mezo (lending protocol built on Solana), similar to Votium for Curve. The project computes which votes maximize yield and provides a UI for executing them efficiently.

## Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Vitest (testing)
- **Contracts:** Hardhat, Solidity (vote optimizer logic)
- **Package Manager:** pnpm 10.33.0 (monorepo: packages/app + packages/contracts)
- **Deploy target:** Solana mainnet (contracts), Vercel (frontend)
- **Testing:** Vitest (app), Hardhat tests (contracts)

## Top-3 commands

```bash
.claude/scripts/green-light.sh   # full gate: tests + lint + types + visual + §14 grep
pnpm dev                          # or npm run dev / cargo run / python main.py
pnpm test                         # or pytest / cargo test / forge test
```

## Library research rule (mandatory)

Before implementing ANYTHING from scratch, you must check Context7 first:

```bash
# Step 1: find the library
mcp__context7__resolve-library-id libraryName="<what you need>"

# Step 2: read the docs
mcp__context7__query-docs context7CompatibleLibraryID="<id>" topic="<specific area>" tokens=5000
```

**If a library exists that solves it, use it. Do not build it yourself.**

This applies to: UI components, form validation, state management, auth, animations, chart/data viz, date handling, file uploads, websockets, crypto primitives — everything.

## Required external libraries (use these, do not reinvent)

| Library | Purpose | How to add |
|---|---|---|
| `@web3-react/core` | Wallet connection | `pnpm add @web3-react/core` |
| `@solana/web3.js` | Solana RPC + transactions | `pnpm add @solana/web3.js` |
| `zustand` | Global state (wallet, votes) | `pnpm add zustand` |
| `zod` | Schema validation | `pnpm add zod` |
| `viem` | Ethereum primitives (if EVM interop) | `pnpm add viem` |

## Rules for this repo

- All wallet state (connected account, balance, votes) goes through Zustand — never useState for shared state
- Contract calls must be real (testnet or live). No mock/fake/dummy contract interactions in hot path
- Vote simulation logic must handle actual Mezo voting mechanics; do not simplify for UI convenience
- All RPC calls must use proper error handling (network timeout, rpc limits, invalid accounts)
- `§14 grep gate` must be clean: no hardcoded contract addresses, no mock data in vote optimizer logic
- Environment variables for RPC endpoints, contract addresses, and wallet configs must be in `.env.local` (not committed)

## BDD acceptance criteria

Read `SPEC.md` for the full list. For each story you implement:
1. Read the Given/When/Then criteria for that story
2. Write the tests FIRST (ATDD — tests come before implementation)
3. Implement until `pnpm test` passes those specific scenarios
4. Check `.claude/last-review.json` after every UI edit — fix before continuing

## Anchor products

- **Votium** (Curve vote optimizer): https://votium.app — reference for vote discovery + execution flow
- **Mezo Protocol**: https://mezo.io — primary integration target, study incentive mechanics
- Anchor screenshots: `screenshots/anchor/` — immutable, never overwrite
- Design tokens: See research/mezo-2026/docs/design-tokens.md (if created)

## pnpm workspace setup

This is a **pnpm monorepo** with two workspace packages:
- `packages/app` — Next.js frontend
- `packages/contracts` — Hardhat smart contracts

**Critical:** All package.json files (root + workspace packages) MUST include:
```json
"packageManager": "pnpm@10.33.0"
```
This is required for GitHub Actions CI to install pnpm correctly. If a package.json is missing this field, CI will fail with "No pnpm version is specified".

**Setup locally:**
```bash
pnpm install --frozen-lockfile      # respects pnpm-lock.yaml
pnpm dev                             # starts all dev servers
pnpm build                           # builds all packages
pnpm test                            # tests all packages
pnpm lint                            # lints all packages
```

## Known pitfalls

- CI will fail if any package.json lacks the `packageManager` field
- Never use `npm install` or `yarn` — this is a pnpm-only project
- `pnpm-lock.yaml` is required; never delete or manually edit it

## Where things live

- **SPEC.md (3-field brief):** `SPEC.md` at repo root — read this first for every task
  - Generated from story file: `research/<hackathon-slug>/docs/stories/story-<slug>.md` (if hackathon project)
  - Contains: Goal, Constraints, Acceptance (extracted from story file)
- **Story file (full context):** `research/<hackathon-slug>/docs/stories/story-<slug>.md`
  - Includes: user story, file map, BDD criteria, shell verification, notes for agents
  - Read this for context beyond the 3-field brief
- **Architecture + PRD:** `research/<hackathon-slug>/docs/architecture.md` + `docs/PRD.md` (locked after Abu approval)
- **Anchor screenshots:** `screenshots/anchor/`
- **Visual test baselines:** `screenshots/baseline/`
- **Reviewer output:** `.claude/last-review.json`
- **PR audit:** `.claude/last-audit.md`
- **Green-light log:** `.claude/green-light.log`

## CI requirement

`.github/workflows/ci.yml` must stay green on every commit. If CI is red:
1. Stop current work
2. Fix the CI failure
3. Re-run green-light.sh
4. Then continue

Never merge a PR while CI is red.
