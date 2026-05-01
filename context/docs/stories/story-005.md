# STORY-005 — Gauge data fetching (Goldsky subgraph + wagmi hooks)

**Epic:** EPIC-3: Dashboard data  
**Priority:** P0  
**Depends on:** STORY-002, STORY-004  
**Estimated effort:** 1.5h

---

## User story

As a user viewing the MezoYield dashboard,  
I want to see all active Mezo gauges with their current APYs and Matchbox incentive amounts,  
So that I can understand where voting power is being allocated and what the rewards are.

---

## File modification map

```
packages/app/
├── lib/
│   ├── subgraph.ts             (Goldsky GraphQL client + gauge query)
│   └── types.ts                (Gauge, GaugeAllocation types)
├── hooks/
│   └── useGaugeData.ts         (React hook: fetches + returns gauges[])
└── components/
    └── Dashboard/
        └── GaugeBoard.tsx      (renders gauge table: name, APY, incentive, my weight)
```

---

## Acceptance criteria

```gherkin
Given the app is running and Goldsky subgraph is reachable
When the Dashboard tab is shown
Then GaugeBoard renders a table of active gauges
And each row shows: gauge name, APY (%), Matchbox incentive (MUSD), my current weight (%)

Given the wallet is NOT connected
When the Dashboard is shown
Then GaugeBoard shows all gauges with APY and incentive data
But "my weight" column shows "—" (not connected state)

Given the Goldsky subgraph returns an error or is unreachable
When the Dashboard is shown
Then GaugeBoard shows an error state (not blank, not broken)
And the error message is user-readable ("Could not load gauge data")
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/app build   # must exit 0
```

---

## Constraints

- Use Goldsky as the data source (hackathon sponsor — points for integration)
- Goldsky endpoint: find from `https://goldsky.com` documentation or Mezo Discord
- If Goldsky endpoint is not discoverable: fall back to direct RPC reads via wagmi `useReadContract`
- Do NOT hardcode gauge addresses in the component — always read from subgraph or contract
- §14: No mock/fake/dummy gauge data in the component hot path
- Loading state required: skeleton rows while data fetches
- APY calculation: derive from Matchbox bribe amount ÷ total veMEZO in gauge × epochs/year
