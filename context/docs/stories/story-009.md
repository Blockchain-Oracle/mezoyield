# STORY-009 — Yield history chart

**Epic:** EPIC-5: Polish  
**Priority:** P1  
**Depends on:** STORY-006  
**Estimated effort:** 1.5h

---

## User story

As a user wanting to understand my MEZO yield performance,  
I want to see a historical chart of MUSD earned per epoch (last 8 epochs),  
So that I can track whether my allocation strategy is working.

---

## File modification map

```
packages/app/
├── components/
│   └── Dashboard/
│       └── YieldChart.tsx       (Recharts bar chart: epoch → MUSD earned)
├── hooks/
│   └── useYieldHistory.ts       (fetch claim events / reward data for last 8 epochs)
└── lib/
    └── subgraph.ts              (add: query for user's claim history from subgraph)
```

---

## Acceptance criteria

```gherkin
Given a user has claimed rewards in previous epochs
When the Dashboard is shown
Then YieldChart renders a bar chart with the last 8 epochs on the X axis
And MUSD earned per epoch on the Y axis (values as numbers)

Given the user has no claim history yet
Then YieldChart shows "No yield history yet"

Given the user claims rewards in the current epoch
Then YieldChart updates to show the new data point

When I hover over a bar
Then a tooltip shows "Epoch N: X.XX MUSD"
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/app build   # must exit 0
```

---

## Constraints

- Use Recharts library (npm add recharts)
- Data source: Goldsky subgraph query for claim events or MezoYieldOptimizer contract event logs
- If subgraph query fails: fall back to contract event reading via wagmi
- X axis: epoch number or date range (e.g., "Week 1", "Week 2")
- Y axis: MUSD earned per epoch (not cumulative)
- Last 8 epochs = most recent complete epoch back 8 weeks
- Responsive: chart should fit in the dashboard container without horizontal scroll
