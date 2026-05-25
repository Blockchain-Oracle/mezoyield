# Contributor Guide — MezoYield

Short reference for anyone (human or coding agent) working in this repo.

## What this is

Set-and-forget MEZO yield optimizer built for **Mezo Hack 2026** (Encode Club, MEZO Track). User connects via Mezo Passport, delegates veMEZO to a non-custodial optimizer contract, and the optimizer auto-votes the highest-incentive Matchbox gauges each epoch. Rewards are denominated and claimed in **MUSD**.

Framing: **one-CTA yield**, not a governance dashboard.

## Stack

- **TypeScript** (strict) + **Next.js 14 App Router**
- **Tailwind v4** (CSS-first, `@import "tailwindcss";`) + **shadcn/ui** (`base-nova`)
- **Wallet:** `@mezo-org/passport` (RainbowKit v2 wrapper — Xverse, Unisat, OKX, EVM)
- **Web3:** `wagmi` v2 + `viem` v2 + `@tanstack/react-query` v5
- **Contracts:** Solidity 0.8.28, Hardhat 2.22
- **Chains:** Mezo Mainnet (chain `31612`, RPC `https://rpc-http.mezo.boar.network`, explorer `https://explorer.mezo.org`) **and** Mezo Testnet (chain `31611`, RPC `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org`, faucet `https://faucet.test.mezo.org`). App selects network via `NEXT_PUBLIC_MEZO_NETWORK`.
- **Indexing:** Goldsky subgraph (fallback: on-chain `useReadContracts`)
- **Charts:** Recharts
- **Tests:** Vitest + Testing Library (app), Hardhat + chai (contracts)
- **Package manager:** pnpm `10.33.0` workspace — never npm/yarn

## Commands

```bash
pnpm install
pnpm dev                                                # Next.js dev server
pnpm --filter @mezoyield/contracts test                 # Hardhat unit tests
pnpm --filter @mezoyield/app test                       # Vitest UI suites
pnpm test && pnpm lint                                  # quick gate
```

Full local gate (matches CI):

```bash
pnpm --filter @mezoyield/contracts run build && \
pnpm --filter @mezoyield/contracts exec tsc --noEmit && \
pnpm --filter @mezoyield/app exec tsc --noEmit && \
pnpm test && pnpm lint && \
pnpm --filter @mezoyield/app run build
```

The contracts `build` must run first — typechain types need to exist before `tsc --noEmit` checks anything that imports them.

## Repo layout

```
packages/
  app/         Next.js 14 frontend
  contracts/   Solidity + Hardhat
  keeper/      Cron worker for epoch automation
docs/
  DEPLOY.md            Coolify / nixpacks deploy reference
  HOW_YIELD_WORKS.md   Plain-English yield mechanics
  MANUAL_TEST_PLAN.md  End-to-end smoke checklist
SPEC.md                Product spec
TESTNET_ADDRESSES.md   Deployed contract addresses (Mezo testnet)
nixpacks.toml          Build config for both Coolify services
```

## House rules

**Hot-path source** (`packages/app/lib/`, `packages/app/hooks/`, `packages/app/components/Dashboard/`, `packages/contracts/contracts/MezoYieldOptimizer.sol`):
- No `mock | fake | dummy | hardcoded` literals. Fixtures live in `__tests__/` and `__fixtures__/`.
- Contract addresses come from `packages/contracts/deployments/mezo-{testnet,mainnet}.json` via `packages/app/lib/contracts.ts` (selected by `NEXT_PUBLIC_MEZO_NETWORK`). Never hardcode an address in a component.
- All chain reads/writes go through wagmi (`useReadContract` / `useWriteContract`). No fake on-chain data.
- No swallowed errors (`catch (_) {}`, `|| true` on commands whose failure matters).

**UI:**
- Palette is locked in `packages/app/app/globals.css` (`@theme inline` block). Bitcoin orange `#F7931A` accent, surface `#1A1A1A`, bg `#0D0D0D`, muted `#9CA3AF`. No purple/pink default Tailwind gradients.
- Inter via `next/font/google` (`--font-sans`). JetBrains Mono for hashes/addresses.
- Hero number is always **"≈ X MUSD/week"** — never raw veMEZO weights or basis points.
- Resolve gauge addresses to human-readable names via subgraph metadata. Never leak raw addresses to the UI.
- Default strategy = **Auto**. Manual is opt-in (sliders).

**Solidity:**
- Pragma `^0.8.20` (compiler 0.8.28).
- Non-custodial: the optimizer holds no balances, no `payable` functions, no stored token approvals.
- All state reads are `view`.

**Repo hygiene:**
- Never commit secrets, keystores, or wallet files (even encrypted).
- Every `package.json` includes `"packageManager": "pnpm@10.33.0"` (CI requires it).
- Doc paths must resolve on the branch they're committed to.

## CI

`.github/workflows/ci.yml` is the gate. Pipeline:

1. `pnpm install --frozen-lockfile`
2. Reject placeholder `test` scripts and PRs with no test files
3. `pnpm --filter @mezoyield/contracts run build`
4. `tsc --noEmit` for both packages
5. `pnpm run lint`
6. `pnpm test`
7. `pnpm --filter @mezoyield/app run build`

Never merge while CI is red.

## Deployment

Both `app` and `keeper` deploy off the same repo via Coolify + nixpacks. The `app` ships as two services off the same image — `mainnet.mezoyield.xyz` (mainnet) and `mezoyield.xyz` (testnet) — each with its own `NEXT_PUBLIC_MEZO_NETWORK`. See `docs/DEPLOY.md` for env vars and service config.

In-app docs route lives at `/docs` on both domains.
