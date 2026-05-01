# Epics — MezoYield
**Version:** 1.0 — 2026-04-30

---

## Dispatch order

Stories must be dispatched in this dependency order. A story cannot start until all `depends_on` stories are COMPLETE.

```
EPIC-1: Foundation
  STORY-001: Monorepo + contract scaffold (no deps)
  STORY-002: UI scaffold + Passport connect (depends on 001)

EPIC-2: Core contract
  STORY-003: MezoYieldOptimizer.sol + tests (depends on 001)
  STORY-004: Deploy to Mezo Testnet + address config (depends on 003)

EPIC-3: Dashboard data
  STORY-005: Gauge data fetching (Goldsky subgraph + wagmi hooks) (depends on 002, 004)
  STORY-006: veMEZO position + epoch countdown (depends on 005)

EPIC-4: Optimize flow
  STORY-007: Optimize modal + vote submission (depends on 006)
  STORY-008: Claim rewards flow (depends on 007)

EPIC-5: Polish
  STORY-009: Yield history chart (depends on 006)
  STORY-010: Submission shell — README, Vercel demo, screenshots, testnet addresses (depends on all)
```

---

## Epic summaries

### EPIC-1: Foundation
Set up the monorepo, contract project, Next.js app, and Mezo Passport connection. No business logic — just the scaffold that every other story builds on.

### EPIC-2: Core contract
Write and deploy `MezoYieldOptimizer.sol`. This is the on-chain surface — vote delegation, auto-allocation submission, manual override, and reward claim forwarding. Must be tested and deployed to Mezo Testnet before any frontend data hooks can be wired.

### EPIC-3: Dashboard data
Wire the Goldsky subgraph and wagmi hooks to surface live gauge data and the user's veMEZO position. The dashboard should be readable in read-only mode (wallet disconnected).

### EPIC-4: Optimize flow
The core user journey: auto-optimize, preview, submit vote, claim rewards. This is the demo moment.

### EPIC-5: Polish
Yield history chart and the submission package (README, live Vercel URL, testnet contract addresses, screenshots).

---

## Story count: 10 stories across 5 epics
**Estimated build time:** 10–15h with Claude Code (1–1.5h per story)  
**Deadline:** May 25, 2026 — 25 days remaining
