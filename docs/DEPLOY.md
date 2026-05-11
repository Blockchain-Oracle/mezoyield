# MezoYield — Coolify Deploy Reference

`nixpacks.toml` at the repo root configures the build for both
deployable services. This doc is the env-var + Coolify-config
reference that goes alongside it.

## Two services, one repo

| Coolify service | `APP_NAME` env | Domain | Notes |
|---|---|---|---|
| **app** | `@mezoyield/app` | `mezoyield.xyz` | Next.js 14, binds to `$PORT` automatically |
| **keeper** | `@mezoyield/keeper` | _(no domain — internal worker)_ | Long-running cron, no HTTP port |

In Coolify:
- **Base Directory**: `/` (repo root). NOT `packages/<name>`. Nixpacks
  needs the workspace root so pnpm can resolve the full monorepo graph.
- **Build pack**: `nixpacks` (auto-detected from `nixpacks.toml`).
- **Public port**: `$PORT` for `app`, none for `keeper`.

## Smoke

Before pushing changes that touch `nixpacks.toml`, the workspace
`package.json` files, or workspace renames, run:

```bash
.claude/scripts/nixpacks-check.sh
```

Validates that each `APP_NAME` in `nixpacks.toml` resolves to a real
workspace with `build` + `start` scripts, and that the install phase's
`onlyIncludeFiles` covers every workspace `package.json`. Catches
drift before it surfaces during a Coolify deploy.

Wired into `.claude/scripts/green-light.sh` so it runs as part of the
standard repo gate.

## Required env vars

### `app` service

| Var | Required | Where | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ in prod | Build + runtime | Get free at https://cloud.walletconnect.com. The app **throws in prod builds** if this is missing; injected wallets (MetaMask, Xverse, Unisat) still work in dev with a placeholder. |
| `NEXT_PUBLIC_GOLDSKY_GAUGES_URL` | optional | Build + runtime | Goldsky subgraph endpoint for gauge data. Read by `packages/app/lib/subgraph.ts`. Fallback path is the wagmi RPC reads (already wired in `useGaugeData`). |
| `PORT` | provided by Coolify | runtime | Coolify sets this; Next.js binds automatically. |

`NEXT_PUBLIC_*` vars are baked into the JS bundle at **build time**.
If you change them you must redeploy, not just restart.

### `keeper` service

| Var | Required | Where | Notes |
|---|---|---|---|
| `KEEPER_PRIVATE_KEY` | ✅ | runtime | EOA that holds the `keeper` role on the deployed optimizer (or the deployer wallet, which doubles as keeper per the deploy manifest). Must be funded with testnet ETH for gas. |
| `KEEPER_RPC_URL` | optional | runtime | Override the default RPC (defaults to the value in `packages/contracts/deployments/mezo-testnet.json`). Useful if you want a private/paid RPC for the keeper. |
| `DISCORD_WEBHOOK_URL` | optional | runtime | Posts a summary on every successful vote. Leave unset to skip. |
| `KEEPER_FORCE` | optional | runtime | Only honored by the manual `pnpm once` invocation, NOT by the cron loop in `index.ts`. Default `"1"` for `pnpm once`; set `"0"` to honor the per-epoch dedup guard. The cron loop always honors the guard. |

## Build phases (what nixpacks does)

1. **setup** — Node 20 LTS + pnpm 10 (extends nixpacks defaults).
2. **install** — `NODE_ENV=development pnpm install --frozen-lockfile`. The
   `NODE_ENV=development` matters because pnpm prunes devDependencies
   in production mode, but the build needs typescript, hardhat, etc.
3. **build** —
   - `pnpm --filter @mezoyield/contracts run build` (hardhat compile +
     typechain — always runs because the app's tsc walks the workspace
     graph; cheap to skip-as-no-op for the keeper deploy too)
   - `pnpm --filter ${APP_NAME} run build`
     - app: `next build` → emits `.next/`
     - keeper: `tsc -p tsconfig.json` → typecheck only; tsx runs from
       `src/` at start time
4. **start** — `pnpm --filter ${APP_NAME} run start`
   - app: `next start` (binds `$PORT`)
   - keeper: `tsx src/index.ts` (cron + boot run)

## Post-deploy verification

### app
- Visit `https://mezoyield.xyz/`
- ProofLedger section should render the most-recent VoteCast tx
  hash from the deployed optimizer (live read against Mezo testnet)
- Connect a wallet → Set & Forget activation modal shows non-zero
  projection from `autoAllocate(gauges)`

### keeper
- Coolify logs: should show `keeper boot — scheduling 00:05 UTC daily cron`
  on startup, then either `tick OK` (with txHash) or `tick skipped (already
  voted this epoch)` on the boot run.
- Mezo Explorer: a fresh `VoteCast` event should appear from the keeper
  EOA within 30s of boot if it hasn't already voted this epoch.

## Re-deploys

- **App**: redeploy on every merge to `main`. Coolify auto-redeploys on
  GitHub push when wired to the repo.
- **Keeper**: redeploy ONLY when the keeper code changes
  (`packages/keeper/`). Restarting the keeper between epoch boundaries
  is safe — the boot run hits the epoch guard and skips if already
  voted.

## Mainnet promotion

When `packages/contracts/deployments/mezo-mainnet.json` lands:
- Add a third Coolify service if you want a separate keeper EOA per
  network (recommended — different gas budgets and risk profiles).
- The frontend reads the deployment manifest at build time
  (`lib/contracts.ts`); the app already accepts both 31611 (testnet)
  and 31612 (mainnet) chain IDs.
- See the mainnet readiness checklist in `docs/MANUAL_TEST_PLAN.md`.
