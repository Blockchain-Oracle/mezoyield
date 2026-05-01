# STORY-007 — Optimize modal + vote submission

**Epic:** EPIC-4: Optimize flow  
**Priority:** P0  
**Depends on:** STORY-006  
**Estimated effort:** 2h

---

## User story

As a user on the Optimize tab,  
I want to set an allocation for my veMEZO across gauges (auto-optimize or manual),  
Preview the vote, and submit it to the blockchain,  
So that my voting power is deployed toward the gauges I choose.

---

## File modification map

```
packages/app/
├── components/
│   └── OptimizeModal.tsx        (strategy selector + allocation sliders + submit button)
├── hooks/
│   ├── useAutoOptimize.ts       (algorithm: which gauges maximize MUSD yield)
│   └── useSubmitVote.ts         (wagmi: execute castOptimalVote on contract)
└── lib/
    └── optimize.ts              (pure allocation algorithm — no mocks)
```

---

## Acceptance criteria

```gherkin
Given the wallet is connected and Optimize tab is shown
When I select "Auto (max MUSD yield)"
Then OptimizeModal shows the computed allocation (e.g., "Gauge A: 45%, Gauge B: 35%, Gauge C: 20%")
And a "Preview" button is visible

When I click "Preview"
Then a modal shows the proposed allocation
And estimated MUSD/epoch based on Matchbox incentive data
And buttons: "Confirm" or "Cancel"

When I click "Confirm"
Then a transaction is submitted to MezoYieldOptimizer.castOptimalVote()
And a loading spinner shows while the tx is in-flight
And on success, a toast shows "Vote submitted! Tx: <hash>"
And the PositionCard allocation updates

When the transaction fails
Then an error toast shows "Vote submission failed: <error message>"
And the user can retry

Given I select "Manual" strategy
Then each gauge has a slider (0–100%)
And the sliders sum to 100%
And I can adjust freely, same submit flow

Given the weights don't sum to 10000 basis points
When I try to submit
Then the UI shows "Weights must total 100%"
And the submit button is disabled
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/app build   # must exit 0
```

---

## Constraints

- Auto-optimize algorithm: rank gauges by (Matchbox_incentive ÷ total_veMEZO_in_gauge) × 52 weeks / 100 = annualized %
- Sort by incentive APY descending, allocate greedily until all veMEZO is assigned
- Manual mode: sliders, not number inputs (better UX for demo)
- §14: No hardcoded allocation data or fake incentives in the hot path
- Use wagmi `useWriteContract` + `useWaitForTransactionReceipt` for vote submission
- Error handling: catch and display revert reasons from the contract
- No polling — use wagmi's built-in receipt waiting
