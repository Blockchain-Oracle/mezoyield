# CLAUDE.md — MezoYield

_Updated: 2026-05-01. Managed by sahil-coding-protocol._

## What this is — and why

MezoYield is a **set-and-forget MEZO yield optimizer** for Mezo Hack 2026 (Encode Club, MEZO Track, deadline 2026-05-25). User connects via Mezo Passport, delegates veMEZO, and the optimizer auto-votes the highest-incentive gauges every epoch. Rewards are denominated and claimed in MUSD.

This repo competes specifically against the **judge-named gap** (don't drift from this):

- Andre Coutinho (Supernormal Foundation, T7): _"we currently don't have anything that is like simple way of getting yield on mezo token today."_
- Dimmitri Paremski (Mezo, T3): _"users don't need to remember about voting every single week."_
- Doug (community lead, T5): _"build for aunt Linda."_
- Andre (T7): _"don't build a website with no teeth."_ — real testnet contract calls, not a deck.
- Ryan Fox (T4): _"MUSD is the hero. Move it around the ecosystem."_

**Strongest SCAMPER angle:** Eliminate gauge literacy + Modify cadence (weekly → autopilot). 2025 had no winner on the MEZO/governance lane — open whitespace.

**Load-bearing product rules** (every UI/UX decision must obey):
1. Default = Auto strategy. Manual is opt-in.
2. Hero number on every screen = "≈ X MUSD/week". Never raw veMEZO weights or basis points.
3. Gauges shown by human-readable name. Never raw addresses.
4. Demo path: connect → see position → click one CTA → confirm → done. ≤30s.
5. Real testnet calls. No mocks in hot path (§14). Mocks for IGaugeController/IMatchbox are fine **only** because Mezo hasn't published real addresses (CONTEXT.md open question #6) — disclose in TESTNET_ADDRESSES.md.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| UI | Tailwind v4 (CSS-first) + shadcn/ui (radix primitives) |
| Wallet | `@mezo-org/passport` (RainbowKit wrapper for Xverse/Unisat + EVM) — MANDATORY |
| Web3 | wagmi v2 + viem v2 |
| Contracts | Solidity 0.8.28, Hardhat (EVM, NOT Solana) |
| Chain | Mezo testnet — Chain ID **31611**, RPC `https://rpc.test.mezo.org`, faucet `https://faucet.test.mezo.org` |
| Indexing | Goldsky subgraph (sponsor) — fallback to wagmi `useReadContracts` |
| Charts | Recharts |
| Testing | Vitest (`packages/app`), Hardhat + chai (`packages/contracts`) |
| Package manager | pnpm 10.33.0 (workspace) — never `npm` or `yarn` |

## Codex Flow (cross-lab review — non-negotiable)

This repo runs a **dual-lab review loop** because same-lab review (Claude reviewing Claude) has correlated blind spots. Two Codex touchpoints, one per side of the push:

1. **Pre-push (local):** before `gh pr create`, run a local Codex review on the diff. Codex CLI is installed on Abu's machine. Use one of:
   - `codex:review-loop` skill — implement → diff → Codex review → address → push (preferred for stories)
   - `codex:rescue` skill — when stuck or want a second diagnosis pass
   - Direct: `git diff origin/main...HEAD > /tmp/changes.patch && codex exec --search --xhigh "Review /tmp/changes.patch. Categories: logic, security, perf, frontend. Pass/Fail per category with file:line. Find at least one substantive issue."`
2. **Post-push (GitHub):** the **`chatgpt-codex-connector[bot]`** auto-reviews every PR. Triage per `AGENTS.md`:
   - Block-class (missing tests, swallowed errors, mock data in hot path, hardcoded secrets, sponsor IDs in logic): **always fix**.
   - Flag-class (premature abstraction, narrating comments, BC shims): fix if cheap, otherwise reply `noted, deferring`.
   - Stylistic opinions (naming, comment frequency): **ignore unless obviously right** — Abu's words: "Codex is just an opinion, you are the developer."
   - **Always read inline comments via `gh api repos/Blockchain-Oracle/mezoyield/pulls/<n>/comments`.** `gh pr view` only shows the headline review; per-line P1/P2 suggestions live under the inline endpoint and are easy to miss.

If Codex flags a real issue, force-push the fix; Codex re-reviews on commit change. Merge after CI is green AND Codex either 👍'd or remaining suggestions are non-blocking.

## Skills & plugins available in this repo

These are pre-installed on Abu's environment. Use them by name when the trigger applies:

**Coding loop:**
- `sahil-coding-protocol` — master playbook (3-field brief, green-light loop, cross-lab review, CLAUDE.md hygiene). Auto-invoked on real coding tasks.
- `superpowers:writing-plans` / `executing-plans` — spec → plan → execute with review checkpoints.
- `superpowers:test-driven-development` — write tests first, implement until green.
- `superpowers:verification-before-completion` — run verification commands before claiming work done.
- `superpowers:systematic-debugging` — root-cause first, fix second.

**Codex / cross-lab:**
- `codex:review-loop` (a.k.a. `review-loop:review-loop`) — implement → independent Codex review → address feedback. Use on every story PR.
- `codex:rescue` — delegate to Codex when stuck or want a deeper investigation pass.
- `codex:setup` — verify Codex CLI is ready.

**PR review fan-out:**
- `pr-review-toolkit:review-pr` — full reviewer fleet (security, performance, types, silent failures, comments, tests).
- `review-fleet` — same fan-out via slash command.

**Frontend craft:**
- `frontend-design:frontend-design` — distinctive, non-generic UI. Use whenever the spec is light on UI (this project's stories are).
- `chrome-devtools-mcp:chrome-devtools` — debug rendered output, perf, a11y.
- `figma:figma-implement-design` — translate Figma to code if anchor screenshots come from Figma.

**Vercel (deploy/post-merge — Abu owns this, do not run from agent):**
- `vercel:deploy`, `vercel:status`, `vercel:env` — only invoke if Abu explicitly asks.

**Repo plumbing:**
- `commit-commands:commit`, `commit-commands:commit-push-pr`
- `claude-md-management:revise-claude-md` — for THIS file's hygiene
- `episodic-memory:remembering-conversations` — recall past decisions before repeating analysis

## Top-3 commands

```bash
.claude/scripts/green-light.sh   # full gate: tests + lint + types + build (workspace-aware)
pnpm dev                         # Next.js dev server (packages/app)
pnpm test                        # Vitest (app) + Hardhat (contracts)
```

## Library research rule (mandatory)

Before implementing ANYTHING from scratch, check Context7 first:

```bash
mcp__context7__resolve-library-id libraryName="<what you need>"
mcp__context7__query-docs context7CompatibleLibraryID="<id>" topic="<area>" tokens=5000
```

If a library exists that solves it, use it. Do not build it yourself.

## Required external libraries (use these, do not reinvent)

| Library | Purpose | Notes |
|---|---|---|
| `@mezo-org/passport` | Wallet connect (Bitcoin + EVM) — **MANDATORY hackathon integration** | exposes `getConfig({ appName })` + `mezoTestnet` chain object; reuse, don't redefine |
| `viem` | EVM client, contract reads/writes | v2 only |
| `wagmi` | React wallet hooks | v2 only |
| `@rainbow-me/rainbowkit` | Connect modal | wired through `@mezo-org/passport` |
| `@tanstack/react-query` | Async data + retries | required by wagmi v2 |
| `graphql-request` | Goldsky subgraph queries | `recharts` for yield chart |
| `zod` | Schema validation at boundaries | only at I/O edges |

**Do NOT use** `@solana/web3.js`, `@web3-react/core`, `ethers.js` for app code — Mezo is EVM, viem only. Hardhat may use ethers via `hardhat-toolbox`.

## Context (read before implementing)

```
context/CONTEXT.md                       master entrypoint (judge signals, primitives, open questions)
context/00-overview.md … 09-...md        researcher's full survey
context/docs/PRD.md                      product requirements
context/docs/architecture.md             stack + repo shape + ADRs
context/docs/ux-spec.md                  layout, anchor (Liquity v2 Bold), tokens
context/docs/stories/story-NNN.md        per-story spec (WHAT)
context/docs/sprint-status.yaml          live sprint state — update after each merge
context/refs/repos/musd/                 mezo-org/musd clone — Solidity reference for MUSD CDP patterns
context/refs/sdk-snippets.md             Passport setup, Hardhat config, MUSD interaction patterns
```

For each story you implement:
1. Read `context/docs/stories/story-<slug>.md` for full BDD criteria.
2. Cross-check against `context/docs/PRD.md` + `context/docs/ux-spec.md` for product framing.
3. Write tests FIRST (ATDD).
4. Implement until `pnpm test` passes the BDD scenarios.

## Rules for this repo

- **Mezo is EVM** (Chain ID 31611) — use viem/wagmi. Never Solana libs.
- Mezo Passport is mandatory for wallet connection. Do not roll your own.
- MUSD integration is mandatory — yield must be displayable and claimable in MUSD.
- All contract calls hit real Mezo testnet — no mocks in hot path. (Mock IGaugeController/IMatchbox are deployed to testnet only because Mezo's real addresses aren't published yet; disclose.)
- `§14 grep gate` must be clean: no `mock`, `fake`, `dummy`, `TODO`, hardcoded contract addresses in component hot paths.
- Contract addresses live in `packages/contracts/deployments/mezo-testnet.json` and are imported via `packages/app/lib/contracts.ts`. Never hardcode in components.
- Hardhat env var is `DEPLOYER_PRIVATE_KEY` (not `PRIVATE_KEY`) — see `packages/contracts/hardhat.config.ts`.
- pnpm workspace only — never `npm install` or `yarn`. All `package.json` files include `"packageManager": "pnpm@10.33.0"`.
- Never commit secrets, keystores, or wallet files — even encrypted (AGENTS.md "block on hardcoded secrets").

## pnpm workspace setup

```bash
pnpm install --frozen-lockfile
pnpm dev                                  # Next.js (packages/app)
pnpm build                                # all packages
pnpm test                                 # all packages
pnpm lint                                 # all packages
pnpm --filter @mezoyield/contracts build  # hardhat compile only
pnpm --filter @mezoyield/app build        # next build only
```

## BDD acceptance loop

1. Read story BDD criteria.
2. Translate Given/When/Then into test cases (vitest for app, chai for contracts).
3. Tests fail → implement → tests pass → run green-light → push.

## Anchor products (UI craft)

- **Liquity v2 Bold** — anchor for layout, tokens, voting/delegation panels. MIT, fork-friendly. https://github.com/liquity/bold
- **Aerodrome** (Base) — reference for veToken APY display patterns.
- **Convex Finance** — reference for "set-and-forget" vault flow.
- **Votium** — reference for incentive APY board.

Design tokens (overrides on top of Liquity Bold defaults): primary `#F7931A` (Bitcoin orange), bg `#0D0D0D`, surface `#1A1A1A`. Apply via Tailwind v4 `@theme inline` in `packages/app/app/globals.css`.

## Known pitfalls

- Mezo is EVM. Never Solana.
- CI requires `packageManager` in every package.json.
- Tailwind v4 uses `@import "tailwindcss";` in CSS — NOT v3-style `@tailwind base/components/utilities`. Don't import non-existent paths like `shadcn/tailwind.css`.
- `gh pr view` only shows the headline review. Always check inline review comments via `gh api .../pulls/<n>/comments` for Codex P1/P2 suggestions.
- Branch protection: PR head must be up-to-date with main before merge. Use `gh pr update-branch <n>` to refresh.
- Hardhat compile must run before `tsc --noEmit` once tests reference typechain types — CI is ordered accordingly.

## Where things live

- Plans: `~/.claude/plans/<slug>.md` (per session)
- Memory: `~/.claude/projects/-Users-abu-dev-hackathon-mezo-hack/memory/`
- Anchor screenshots: `screenshots/anchor/` — immutable, never overwrite
- Reviewer output: `.claude/last-review.json`
- Green-light log: `.claude/green-light.log`
- Sprint status: `context/docs/sprint-status.yaml` — update `status`/`completed_at`/`pr_url` after each story merges

## CI requirement

CI must stay green on every commit. If CI is red: stop, fix, re-run green-light.sh, then continue. Never merge a PR while CI is red.
