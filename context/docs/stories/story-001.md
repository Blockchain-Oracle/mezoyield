# STORY-001 — Monorepo + contract scaffold

**Epic:** EPIC-1: Foundation  
**Priority:** P0  
**Depends on:** none  
**Estimated effort:** 1h

---

## User story

As a developer starting the MezoYield build,  
I want a pnpm monorepo with `packages/contracts` (Hardhat) and `packages/app` (Next.js 14),  
So that all subsequent stories have a stable, compilable scaffold to build on.

---

## File modification map

```
mezoyield/
├── package.json                    (root pnpm workspace)
├── pnpm-workspace.yaml
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   ├── hardhat.config.ts
│   │   ├── tsconfig.json
│   │   ├── contracts/
│   │   │   └── .gitkeep
│   │   └── test/
│   │       └── .gitkeep
│   └── app/
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.ts
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx
│       └── components/
│           └── .gitkeep
```

---

## Acceptance criteria

```gherkin
Given the repo is cloned and pnpm install runs
When I run `pnpm --filter @mezoyield/contracts build`
Then it exits 0 with no TypeScript errors

When I run `pnpm --filter @mezoyield/app build`
Then it exits 0 with no TypeScript errors

When I run `pnpm --filter @mezoyield/contracts test`
Then it exits 0 (empty test suite is acceptable at this stage)
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/contracts build
pnpm --filter @mezoyield/app build
```

---

## Constraints

- Use pnpm workspaces (not yarn or npm)
- Hardhat with TypeScript config (`hardhat.config.ts`)
- Next.js 14 with App Router and TypeScript
- Tailwind CSS configured in the app package
- shadcn/ui initialized (`npx shadcn-ui@latest init`)
- Do NOT add wagmi/viem yet — that's STORY-002
- Do NOT add any contract code yet — scaffold only
