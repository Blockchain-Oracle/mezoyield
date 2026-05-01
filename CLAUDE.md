# CLAUDE.md — MezoYield

_Updated: 2026-05-01. Managed by sahil-coding-protocol._

## What this is

Set-and-forget MEZO yield optimizer for the Mezo Hack 2026 (Encode Club, **MEZO Track**, deadline 2026-05-25). User connects via Mezo Passport, delegates veMEZO to a non-custodial optimizer contract, and the optimizer auto-votes the highest-incentive Matchbox gauges every epoch. Rewards denominated and claimed in **MUSD**. Wedge framing (per `context/09-first-principles-scamper-analysis.md`) is the SCAMPER **Eliminate + Modify** angle on Mezo's gauge system: eliminate gauge literacy, modify cadence from "weekly chore" to autopilot. The judge-named gap (Andre Coutinho, Transcript 7): _"we currently don't have anything that is like simple way of getting yield on mezo token today."_ 2025 had no winner on the MEZO/governance lane — open whitespace. Bore Finance covers veBTC delegation only; MezoYield differentiates by adding veMEZO + analytics + MUSD-denominated rewards.

Frame as **set-and-forget yield with one CTA** — never as "governance dashboard," "gauge analytics tool," or "voting UI."

## Stack

- **Language:** TypeScript (strict)
- **Framework:** Next.js 14 App Router
- **Styling:** Tailwind v4 (CSS-first via `@import "tailwindcss";`) + shadcn/ui (style `base-nova`, primitives via `@base-ui/react`)
- **Wallet:** `@mezo-org/passport` 0.17.2 (RainbowKit v2 wrapper for Xverse, Unisat, OKX + EVM) — **MANDATORY hackathon integration**
- **Web3:** wagmi v2 + viem v2 + `@tanstack/react-query` v5
- **Contracts:** Solidity 0.8.28, Hardhat 2.22 (EVM, NOT Solana)
- **Chain:** Mezo testnet — **Chain ID 31611**, RPC `https://rpc.test.mezo.org`, faucet `https://faucet.test.mezo.org`, explorer `https://explorer.test.mezo.org`
- **Indexing:** Goldsky subgraph (sponsor) — fallback to wagmi `useReadContracts` against the deployed optimizer
- **Charts:** Recharts (added in STORY-009)
- **Testing:** Vitest + Testing Library + jsdom (`packages/app`); Hardhat + chai (`packages/contracts`)
- **Package manager:** pnpm 10.33.0 workspace (never `npm` or `yarn`)
- **Deploy target:** Abu deploys off-Vercel, post-merge (do NOT install Vercel CLI from the agent)

## Top-3 commands

```bash
# Full local gate — run per-package because root tsconfig excludes packages/.
pnpm --filter @mezoyield/contracts run build && \
pnpm --filter @mezoyield/contracts exec tsc --noEmit && \
pnpm --filter @mezoyield/app exec tsc --noEmit && \
pnpm test && pnpm lint && \
pnpm --filter @mezoyield/app run build

pnpm dev                                                                              # Next.js dev server (packages/app)
pnpm --filter @mezoyield/contracts test                                                # Hardhat unit tests
```

The contracts `build` runs first because typechain types must exist before `tsc --noEmit` checks any code that imports them.

`.claude/scripts/green-light.sh` runs the same gates and is workspace-aware (post-#17 cleanup) — but rely on the explicit `pnpm` commands above for verification, since the script's full plumbing isn't covered by tests.

## Codex Flow (review discipline — non-negotiable)

This repo runs **dual-lab review** because same-lab review (Claude reviewing Claude) has correlated blind spots. Two touchpoints, one per side of the push:

1. **Pre-push (local):** before `gh pr create`, run a Codex review of the diff. Codex CLI is installed (`/opt/homebrew/bin/codex`).
   - **Use** `codex exec review --base main --full-auto --title "<short title>" '<prompt>'` — non-interactive, sandbox approvals skipped.
   - **Do NOT** use `codex review` (top-level) — that's the TUI and it hangs in non-tty contexts.
   - **Force binary verdicts** + file:line citations + "find at least one substantive issue" framing in the prompt.
   - Address every valid finding before pushing.
2. **Post-push (GitHub):** **`chatgpt-codex-connector[bot]`** auto-reviews every PR push. Triage per `AGENTS.md`:
   - **Block-class** (missing tests, swallowed errors, mock data in hot path, hardcoded secrets, sponsor IDs, doc/code drift): **always fix.**
   - **Flag-class** (premature abstraction, narrating comments, BC shims): fix if cheap, otherwise reply "noted, deferring."
   - **Stylistic opinions** (naming, comment frequency): ignore unless obviously right. Per Abu: "Codex is just an opinion, you are the developer."
   - **Always read inline comments** via `gh api repos/Blockchain-Oracle/mezoyield/pulls/<n>/comments`. `gh pr view` only shows the headline review; per-line P1/P2 suggestions are easy to miss.
   - **Bot reactions:** `eyes` = reviewing, `+1` = approved, comments = issues to triage.
3. After fixes, force-push or follow-up commit. Bot re-reviews on commit change.
4. **Never merge while CI red or Codex blockers open.**

## Hierarchy of truth — never invent an API signature

Hallucinated symbols are the most expensive error class on this repo (Codex catches them post-push, after the round-trip). **Look it up before writing.** Order:

1. **`context/` folder** — repo-local, authoritative for THIS project. PRD, architecture, ux-spec, story BDDs, sdk-snippets, sponsor-repos, transcripts, prior-winners. First stop, every time.
2. **Installed package source** — `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/dist/**/*.d.ts` and the package's `README.md`. Confirms real exports + return shapes. Especially load-bearing for `@mezo-org/passport` (its docs are sparse; the .d.ts files are authoritative).
3. **Context7 MCP** — `mcp__plugin_context7_context7__resolve-library-id` then `query-docs`. Current docs for libraries (Next.js App Router, viem, wagmi, RainbowKit, shadcn, Recharts, Hardhat, etc.).
4. **Official docs / repos via plugin skills** — `vercel:nextjs`, `vercel:shadcn`, `microsoft-docs:microsoft-docs`, `chrome-devtools-mcp:chrome-devtools`.
5. **Web search** — `tavily`, `exa:search`, `firecrawl:firecrawl`, `brave-api-search` for things not in Context7.
6. **Sponsor repos** — `context/refs/sponsor-repos.md` + `context/refs/repos/musd/` (locally cloned). MUSD CDP patterns live here.

Pass this rule into every subagent brief. "If you don't know, look it up — don't guess at an API."

## Required external libraries (locked)

_Status reflects what's on `main`. "PR #N" means the lib lands when that PR merges._

**Versioning rule:** never pin a patch version when adding a dependency — let pnpm resolve. Use `pnpm --filter @mezoyield/<pkg> add <name>` (no version) so pnpm picks the latest compatible release; the resulting `^x.y.z` in `package.json` is a major-version range and is what we want. The major versions listed below are the COMPATIBILITY constraints (e.g. wagmi must be v2 because that's what `@mezo-org/passport` peers against — wagmi v3 exists and pnpm will pick it by default unless you specify the major). Only specify a version like `wagmi@2` when there's an active peer-dep mismatch; never `wagmi@^2.5.12`.

| Library | Purpose | Major | Status |
|---|---|---|---|
| `@mezo-org/passport` | Wallet connect (Bitcoin + EVM) — see Codex Flow note below | 0.x | pending PR #18 (STORY-002) |
| `@rainbow-me/rainbowkit` | Connect modal | v2 | pending PR #18 (STORY-002) |
| `wagmi` + `viem` | EVM hooks + low-level client | v2 (peers of Passport) | pending PR #18 (STORY-002) |
| `@tanstack/react-query` | Async data layer | v5 (peer of wagmi v2) | pending PR #18 (STORY-002) |
| shadcn/ui Button + `cn()` helper | UI primitives via `@base-ui/react` | — | ✅ on `main` (#15) |
| shadcn/ui Tabs | Tabs primitive | — | pending PR #18 (STORY-002) |
| shadcn/ui Dialog + Slider | Optimize-flow primitives | — | STORY-007 |
| `graphql-request` | Goldsky subgraph queries | latest | STORY-005 |
| `recharts` | Yield history chart | latest | STORY-009 |
| `zod` | Schema validation at I/O edges | latest | STORY-005 |
| Hardhat + `@nomicfoundation/hardhat-toolbox` | Compile + test + deploy | v2.x | ✅ on `main` |

**Do NOT use** `@solana/web3.js`, `@web3-react/core`, `ethers.js` for app code. Mezo is EVM, viem only. Hardhat may use ethers transitively via `hardhat-toolbox`. ADR-mandated exception: contracts ship a `MockGaugeController` + `MockMatchbox` deployed alongside the optimizer, because Mezo's real gauge/matchbox addresses aren't documented yet (CONTEXT.md open question #6) — disclose in `TESTNET_ADDRESSES.md`.

**Note on `@mezo-org/passport` vs vanilla RainbowKit:** Mezo's own gauge dApp (`mezo-org/tigris`) uses vanilla `getDefaultConfig` from `@rainbow-me/rainbowkit` with `ssr: true`, NOT `@mezo-org/passport`. Tigris's `dapp/` is the canonical Next.js + wagmi v2 wiring on Mezo and is cloned at `context/refs/repos/tigris/dapp/` for reference. STORY-002 uses Passport per its BDD spec; future stories should consider whether the simpler Tigris wiring is preferable.

## Rules for this repo (anti-slop list — grows with every burn)

**Hot-path source files (`packages/app/lib/`, `packages/app/hooks/`, `packages/app/components/Dashboard/`, `packages/contracts/contracts/MezoYieldOptimizer.sol`):**
- No `mock|fake|dummy|hardcoded` strings (§14 grep gate). Fixtures and recording adapters live under `__tests__/` and `__fixtures__/`.
- Contract addresses come from `packages/contracts/deployments/mezo-testnet.json` via `packages/app/lib/contracts.ts`. Never hardcode an address in a component.
- No fake on-chain calls. wagmi `useReadContract` / `useWriteContract` against the deployed optimizer at all times.
- No swallowed errors (`catch (_) {}`, `|| true` on commands whose failure matters). Surface or log with reason.
- No fallbacks that silently disable mandatory functionality (e.g. WalletConnect project ID): fail fast in production.

**UI:**
- Never `from-purple-500 to-pink-500`, `from-violet-* to-indigo-*`, or any default Tailwind purple gradient.
- Never `font-sans` without an explicit `next/font/google` import. Inter is loaded with `--font-sans` in `app/layout.tsx`.
- Never `text-gray-600` on white. Use the UX-spec palette (Bitcoin orange `#F7931A` accent, surface `#1A1A1A`, bg `#0D0D0D`, muted `#9CA3AF`).
- Never invent gauge names, addresses, or APYs in components. Pull from subgraph or contract — see CONTEXT.md hierarchy of truth.
- Never show raw veMEZO weights or basis points to the user. Hero number is always **"≈ X MUSD/week"**.
- Never show raw gauge addresses. Resolve to human-readable names via subgraph metadata.
- Default UI strategy = **Auto**. Manual is opt-in (sliders).
- All shared client state goes through wagmi hooks — never `useState` for connection / chain / balance state.

**Docs / config:**
- Every path mentioned in CLAUDE.md / READMEs / PR descriptions must resolve on the branch.
- Doc claims about scripts must match script behavior — verify before writing.
- No orphaned gitlinks without `.gitmodules`.
- Never commit secrets, keystores, or wallet files — even encrypted (AGENTS.md "block on hardcoded secrets").
- All `package.json` files include `"packageManager": "pnpm@10.33.0"` (CI requires it).

**Solidity:**
- Pragma `^0.8.20` (compiler 0.8.28).
- Non-custodial: contract holds no balances, no `payable` functions, no token approvals stored.
- Custom errors over `require` strings — exception: STORY-003 acceptance literally requires the strings `"weights must sum to 10000"` and `"not authorized"`; use `require(... , "...")` for those exact paths.
- All state reads are `view`. No gas on reads.

## §14 grep gate — hot-path verification

Before commit, on any PR that adds or modifies a hot-path source file:

```bash
# Exits 0 when clean, 1 when a forbidden token is found.
# Skips paths that don't yet exist on the branch so the gate stays valid
# story-by-story as the file tree fills in.
HOT_PATHS=(
  packages/app/lib
  packages/app/hooks
  packages/app/components/Dashboard
  packages/contracts/contracts/MezoYieldOptimizer.sol
)
EXISTING=()
for p in "${HOT_PATHS[@]}"; do [ -e "$p" ] && EXISTING+=("$p"); done

if [ ${#EXISTING[@]} -eq 0 ]; then
  echo "§14 grep gate: no hot-path files yet — clean."
  exit 0
fi

set +e
MATCHES=$(grep -rEl 'mock|fake|dummy|hardcoded' "${EXISTING[@]}" 2>&1)
RC=$?
set -e

# grep exit codes: 0 = matches found, 1 = no matches, 2 = error.
# We must distinguish: only exit 1 (no match) is "clean". Exit 2 means
# something is wrong with the scan itself (read error, bad pattern) and
# the gate must fail closed — never silently pass.
if [ $RC -eq 2 ]; then
  echo "§14 grep gate ERROR — grep failed to scan:" >&2
  echo "$MATCHES" >&2
  exit 2
fi

if [ $RC -eq 0 ] && [ -n "$MATCHES" ]; then
  echo "§14 grep gate FAIL — forbidden tokens in:" >&2
  echo "$MATCHES" >&2
  exit 1
fi

echo "§14 grep gate: clean."
```

Test fixtures under `__tests__/` and `__fixtures__/` are exempt. Solidity mocks under `packages/contracts/contracts/mocks/` are also exempt — they exist only because Mezo's real gauge/matchbox addresses are undocumented (disclose in `TESTNET_ADDRESSES.md`).

Hot-path scope grows with the project — when a new lib/hook/component lands that handles real on-chain data, add its path to the list above in the same PR.

## Burn list (the Codex/PR-pitfalls log — pre-empt these)

Every entry below is a P1 or P2 Codex flagged on a previous PR. Treat as the standing trip-wire.

1. **#13 P2 — Doc paths that don't exist on the branch.** CLAUDE.md referenced `research/mezo-2026/...` after the folder moved to `context/...`. **Fix forever:** every path in CLAUDE.md / READMEs / PRs must resolve on the branch.
2. **#14 P1 — Scaffold-mode CI gate skipped real-code PRs.** Threshold-of-3 lets a 1–3-file PR merge without lint/test/typecheck. **Fix forever:** dropped scaffold mode entirely (#17). All PRs run full gates.
3. **#14 P2 — `\|\| true` swallows command errors.** Anywhere a fallback is appended to a command whose failure matters, the failure becomes invisible. **Fix forever:** removed; surface errors.
4. **#15 P1 — Tailwind v4 `@tailwind` directives.** v4 wants `@import "tailwindcss";`, NOT v3-style `@tailwind base/components/utilities`. The PostCSS plugin tolerates the legacy syntax silently, so build "passes" without utilities being generated. **Fix forever:** v4 imports only.
5. **#16 P1 — Committed wallet keystores.** Even encrypted, key material is "block on secrets" per AGENTS.md. **Fix forever:** scale-testing/load-test artifacts are not committed; reference repos cloned for source only.
6. **#18 P2 — shadcn `base-nova` Tabs ships v3-style `data-horizontal:` selectors.** Base UI emits `data-orientation="horizontal"` (with a value) — Tailwind needs `data-[orientation=horizontal]:`. Active state is `data-active` (presence-only) — bare `data-active:` selector matches. **Fix forever:** when adding any new shadcn primitive, audit the data-attribute selectors against the underlying primitive's emitted attributes.
7. **#18 P2 — `next/dynamic({ ssr: false })` on the route shell empties the SSR HTML.** The dynamic component's loading fallback REPLACES children server-side; they're not rendered until client mount. **Fix forever:** for client-only providers, lazy-import the stack inside `useEffect` so children render unwrapped during SSR. Wrap individual wagmi-hook-using components (e.g. ConnectButton) in `dynamic({ssr:false})` instead of the whole route.
8. **#18 P1 — STORY-002 BDD coverage gap.** Tests covered the trigger labels but not the click-switches-panel and connected-state criteria. **Fix forever:** PR description must list explicit BDD-line → test-name mapping; every Given/When/Then has a corresponding `it`.
9. **#18 P1 — Silent placeholder for `walletConnectProjectId` hides config errors.** Falling back to `"mezoyield-dev"` lets a prod deploy ship a half-broken WalletConnect flow. **Fix forever:** throw in `NODE_ENV === "production"` if the env var is missing; warn in dev with a sentinel placeholder so injected wallets keep working locally.

## BDD acceptance criteria

Story BDDs live in `context/docs/stories/story-NNN.md`. For each story:

1. Read the Given/When/Then for that story. Cross-check against `context/docs/PRD.md` + `context/docs/ux-spec.md` for product framing.
2. Write tests FIRST (ATDD).
3. Implement until `pnpm --filter @mezoyield/app test` (or `@mezoyield/contracts test`) passes the BDD scenarios.
4. PR description must call out which BDD lines each test encodes.

## Anchor products + design tokens

- **Primary anchor:** **Liquity v2 Bold** (`https://github.com/liquity/bold`, MIT, fork-friendly). Voting/delegation panels, tokens, Panda CSS theming. Same pattern used by MezoStream (April 2026).
- **Secondary anchor:** **Aerodrome** (Base) for veToken APY display patterns.
- **Tertiary anchor:** **Convex Finance** for "set-and-forget" vault flow language.
- **Anchor screenshots:** `screenshots/anchor/` — **immutable**, never overwrite.
- **Visual baselines:** `screenshots/baseline/` — update only via `--update-snapshots` on approved UI changes (set up in STORY-005+ when real UI lands).
- **Palette (UX spec, locked):** primary `#F7931A` (Bitcoin orange), bg `#0D0D0D`, surface `#1A1A1A`, border `#2A2A2A`, text-primary `#FFFFFF`, text-secondary `#9CA3AF`, success `#10B981`, warning `#F59E0B`. Apply via Tailwind v4 `@theme inline` block in `packages/app/app/globals.css`.
- **Type:** Inter via `next/font/google`, JetBrains Mono for hashes/timestamps/addresses (add when needed).
- **Spacing:** 4px base scale (4, 8, 12, 16, 24, 32, 48, 64).
- **Route shape:** single `/` with `Dashboard | Optimize` mode toggle. **Default landing = Dashboard.** Per-story panel content arrives in STORY-005…STORY-009.

## Skills + plugins to invoke (Sahil's protocol)

| Trigger | Skill |
|---|---|
| Master coding protocol (every task) | `sahil-coding-protocol` |
| Behavioral guard against LLM coding mistakes | `karpathy-skills:karpathy-guidelines` (think before coding, simplicity first, surgical changes, goal-driven execution) |
| Starting any non-trivial task | `superpowers:writing-plans` (refine via `/ultraplan` before approving — see Abu's pattern) |
| Implementing a feature | `superpowers:test-driven-development` (tests first, ATDD against story BDD) |
| Before claiming done | `superpowers:verification-before-completion` (run full local gate) |
| Before opening a PR | `superpowers:requesting-code-review` |
| Cross-lab review of own work | `sahil-pr-audit` (preferred) — fall back to `codex exec review --full-auto` |
| Codex review/rescue on a chunk | `codex:rescue` or `review-loop:review-loop` |
| Debugging a non-trivial bug | `superpowers:systematic-debugging` |
| 2+ independent tasks | `superpowers:dispatching-parallel-agents` |
| UI work BEFORE editing any frontend file | `sahil-ui-mining` (anchor first; capture screenshots into `screenshots/anchor/`) |
| Vision audit BEFORE merging UI | `sahil-anti-slop-audit` |
| Commit + push + PR | `commit-commands:commit-push-pr` |
| Memory recall across sessions | `episodic-memory:remembering-conversations` |

If I'm tempted to skip these "just for this task" — that's the slop voice. Don't.

## Where things live

- **Plans (current sprint):** `~/.claude/plans/<slug>.md` (per session)
- **Memory (cross-session):** `~/.claude/projects/-Users-abu-dev-hackathon-mezo-hack/memory/`
- **Hackathon research:** `context/00-overview.md`…`09-first-principles-scamper-analysis.md`, `context/CONTEXT.md` (master entrypoint)
- **PRD + architecture:** `context/docs/PRD.md`, `context/docs/architecture.md`
- **UX spec:** `context/docs/ux-spec.md` (palette, anchor, layout shapes, anti-slop)
- **Stories:** `context/docs/stories/story-NNN.md` (BDD per ticket)
- **Sprint status:** `context/docs/sprint-status.yaml` — **update after each story merges** (status, completed_at, pr_url)
- **SDK refs:** `context/refs/sdk-snippets.md` (Mezo testnet constants, Passport getConfig, Hardhat config, MUSD interaction)
- **Sponsor repos:** `context/refs/sponsor-repos.md` + `context/refs/repos/musd/` (cloned MUSD source)
- **CI gate:** `.github/workflows/ci.yml`
- **Local green-light:** `.claude/scripts/green-light.sh` (workspace-aware post-#17)
- **Anchor screenshots:** `screenshots/anchor/` (NEVER overwrite — captured day-0, post-STORY-005)
- **Visual baselines:** `screenshots/baseline/`
- **Reviewer output:** `.claude/last-review.json` (after every UI edit)

## CI requirement

`.github/workflows/ci.yml` must stay green on every commit. Pipeline (post-#17):

1. `pnpm install --frozen-lockfile`
2. Reject placeholder `test` script + reject if no test files exist
3. `pnpm --filter @mezoyield/contracts run build` (compiles contracts → typechain types must exist before tsc)
4. `pnpm --filter @mezoyield/contracts exec tsc --noEmit` + `pnpm --filter @mezoyield/app exec tsc --noEmit`
5. `pnpm run lint`
6. `pnpm test`
7. `pnpm --filter @mezoyield/app run build`

If CI is red:
1. Stop current work.
2. Reproduce locally with the failing command.
3. Fix; re-run the full local gate.
4. Then continue.

**Never merge a PR while CI is red or Codex blockers are open.**

## Per-PR checklist (the kite discipline)

Before opening a PR:

- [ ] Tests written FIRST (ATDD against story BDD).
- [ ] Full local gate green (per-package commands — see "Top-3 commands" above; the per-package `tsc --noEmit` matters because root tsconfig excludes `packages/`).
- [ ] §14 grep clean on hot-path source files.
- [ ] `codex exec review --base main --full-auto --title "<title>"` run; valid findings addressed.
- [ ] PR body includes BDD-line → test-name mapping.
- [ ] PR title `feat(story-NNN): …` / `fix: …` / `chore: …`.

After opening:

- [ ] Wait for `chatgpt-codex-connector[bot]` review (~5–10 min).
- [ ] Read inline comments via `gh api repos/Blockchain-Oracle/mezoyield/pulls/<n>/comments`.
- [ ] Triage every comment. Fix block-class. Reply on style-only.
- [ ] After fixes: force-push or follow-up commit; bot re-reviews.
- [ ] Merge after CI green AND bot 👍'd or remaining suggestions are non-blocking.
- [ ] Update `context/docs/sprint-status.yaml` for the merged story.
