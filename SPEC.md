# SPEC — Boar-pattern polish + /docs route

_Branch: `feat/v2-redesign`. Anchor screenshots: `mezo-1.png` (Boar dashboard, primary), `mezo-2.png` (Boar BOOST card detail), `boar-home.png`, `fractals-home.png`._

## Goal

Close the credibility gap vs Boar Finance and Fractals on the **landing** and **dashboard pre-connect state** without adding new wedge claims. Specifically:

1. Ship a **`/docs`** route — single MDX page housing FAQ, optimizer-formula explainer, non-custody disclosure, contracts table. Footer links to it from every page. Replaces the prior "FAQ-on-landing" idea.
2. Add a **`ProtocolEarningsChart`** on the landing — 8-epoch bar chart of aggregate MUSD distributed, sourced from on-chain `RewardsClaimed` logs across all optimizer accounts. Slots between `LiveDataStrip` and `FeatureGrid`. Boar's killer credibility piece, lifted in our visual language.
3. Add a **reverse-empty-state on `/app/dashboard`** — pre-wallet-connect, show one fictional example user row (`Strategy: Set & Forget · 18.42 veMEZO · projected 0.14 MUSD/wk`) with a small `← example` label, with the existing Connect CTA underneath. Swaps to real per-user data on connect.
4. Add a **protocol "most used" badge** on strategy cards (`Set & Forget · 47% of protocol veMEZO uses this`). One data source feeds three surfaces (chart, badge, future leaderboard hook).

## Constraints

- **No new wedge framing.** Wedge stays: set-and-forget MUSD yield, one CTA, MEZO Track. Do NOT rebuild what's already on disk: `Hero`, `Ticker`, `LiveDataStrip`, `ProofLedger`, `Comparison`, `FeatureGrid`, `Footer` ALL stay as-is structurally.
- **Stack:** Next.js 14 App Router, TypeScript strict, Tailwind v4 `@theme inline`, shadcn `base-nova`, Recharts (already locked for STORY-009), wagmi v2 + viem v2 + `@tanstack/react-query` v5.
- **Data sources:** extend `lib/subgraph.ts` for protocol-aggregate when Goldsky endpoint is configured, fall back to `lib/getLogsChunked.ts` reading `RewardsClaimed` events across all accounts on the deployed `MezoYieldOptimizer` (`0x1A9a4f8279F88a1551117766957DB23A35133B6D`). Mirror `useYieldHistory` patterns; create a sibling `useProtocolYieldHistory` hook.
- **§14 grep gate:** zero `mock|fake|dummy|hardcoded` in `packages/app/lib/`, `packages/app/hooks/`, `packages/app/components/Dashboard/`. The reverse-empty-state example data must be a static prop in the component (`features/dashboard/ExampleRow.tsx` or similar), NOT a fake on-chain read, and the component must render an explicit `← example` label so judges and the §14 reviewer can tell it apart from real data at a glance.
- **Palette / typography:** Bitcoin orange `#F7931A` accent (the `text-mezo` token), bg `#0D0D0D`, surface `#1A1A1A`, border `#2A2A2A`. Inter for body, JetBrains Mono for hashes/timestamps. Do not introduce purple, violet, or pink gradients — the existing pink `#FF004D` `text-mezo` value is the only accent.
- **Anchor compliance:** Liquity v2 Bold remains primary anchor (per CLAUDE.md). Boar's pattern is a *credibility-signal lift*, not a design-system lift. Card edges, spacing, type still follow Liquity-class.
- **No mock contracts.** Real on-chain reads against `MezoYieldOptimizer` only. The `MockGaugeController` + `MockMatchbox` testnet stand-ins are allowed because they exist on-chain at known addresses; never invent gauge data in the frontend.
- **No `wagmi` hooks in SSR paths.** Match the existing `useWalletReady()` gate pattern used by `LiveDataStrip` / `Ticker`. The dashboard reverse-empty-state must render pre-hydration without invoking `useAccount`.
- **TDD discipline (CLAUDE.md mandate):** tests written FIRST for every new hook + component. Vitest + Testing Library. BDD-style `describe / it` with Given/When/Then phrasing in `it` strings.
- **Codex review pre-push:** before any PR, run `codex exec review --base feat/v2-redesign --full-auto --title "..."` and address valid findings.
- **CI compatibility:** full local gate must stay green — `pnpm --filter @mezoyield/contracts run build && pnpm --filter @mezoyield/contracts exec tsc --noEmit && pnpm --filter @mezoyield/app exec tsc --noEmit && pnpm test && pnpm lint && pnpm --filter @mezoyield/app run build`.
- **No new dependencies** unless one of (`recharts`, `zod`, `graphql-request`) is genuinely missing from `packages/app/package.json` — verify before adding.

## Acceptance

A merge candidate is "done" when ALL of the following are true:

1. **`/docs` route renders** at `http://localhost:<port>/docs` with sections: Intro · How the optimizer scores gauges · FAQ (6 entries) · Contracts table (from `TESTNET_ADDRESSES.md`) · Non-custody disclosure · Risk disclaimer. Footer "Docs" link visible on every page including `/app/*`.
2. **`ProtocolEarningsChart` renders** on `/` between `LiveDataStrip` and `FeatureGrid`. Renders 8 contiguous epoch bars (zero-fill for absent epochs, per the `useYieldHistory` `padContiguousEpochs` convention). `MUSD` / `BTC` currency toggle in top-right. Shows skeleton during `!walletReady`. When no claim events exist on-chain yet, the chart renders with all-zero bars and a small empty-state line — never invented values.
3. **Dashboard pre-connect state** at `/app/dashboard` shows one example user row labeled `← example` AND the existing Connect Account CTA. Post-connect, the example is replaced by the user's real row from `useVeMezoPosition` + `useYieldHistory` (no flicker).
4. **Strategy cards** in `/app/strategies` show a small `47% of protocol veMEZO` line under the title for the most-used strategy and a quieter `Xx% of protocol veMEZO uses this` for the rest. Hides when protocol total is < 0.01 veMEZO (avoid divide-by-tiny noise).
5. **Tests:** every new file under `lib/`, `hooks/`, `features/`, `components/` has a colocated `.test.ts`/`.test.tsx`. New hooks tested for: empty state, single-epoch case, multi-epoch case, error state. New components tested for: skeleton, with-data, empty-state, currency-toggle. Pass on `pnpm --filter @mezoyield/app test`.
6. **No §14 violations.** Hot-path grep returns clean.
7. **Type-check + lint + build clean** on the full gate.
8. **Codex review** has run on the diff (`codex exec review --base feat/v2-redesign --full-auto --title "feat: /docs route + protocol earnings chart + reverse empty state"`) and no `BLOCKING` issues remain.
9. **CLAUDE.md updated** under "Burn list" if anything new was learned (e.g., a Recharts wiring gotcha).
10. **Visual sanity:** the protocol chart should be visibly smaller than `mezo-1.png`'s chart (we are not out-Boaring Boar); the strategy grid remains the visual hero of the landing.

## Out of scope (explicit non-goals)

- Header status pill (Fractals lift) — DROPPED. The existing Hero already has a live-pulse "Live on Mezo Testnet · Set & Forget online" chip.
- Footer compliance disclaimer (Fractals lift) — DROPPED. The existing Footer already has "Non-custodial; not financial advice."
- Comparison block (Boar lift) — DROPPED. Already exists as `Comparison` on the landing.
- Stats strip (Boar lift) — DROPPED. Already exists as `LiveDataStrip`.
- FAQ on landing — DROPPED. Lives at `/docs`.
- Header pill on `/app/*` routes for chain ID — DROPPED. Acceptable but not required for this slice.
- Marketplace / orderbook UI (Fractals lift) — explicitly not our wedge. Skip.
- veBTC support (Boar's lane) — out of scope. veMEZO + MUSD only.
- Changes to Hero copy or strategy card titles. Untouched.
