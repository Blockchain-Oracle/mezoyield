# STORY-006 — veMEZO position + epoch countdown

**Epic:** EPIC-3: Dashboard data  
**Priority:** P0  
**Depends on:** STORY-005  
**Estimated effort:** 1h

---

## User story

As a user with a connected veMEZO position,  
I want to see my veMEZO balance, my current gauge allocation, and the countdown to the next epoch,  
So that I understand my current holdings and the urgency of voting.

---

## File modification map

```
packages/app/
├── hooks/
│   ├── useVeMezoPosition.ts    (wagmi: read user's veMEZO balance + current allocation)
│   └── useEpochCountdown.ts    (calculate time until next epoch from block time)
└── components/
    └── Dashboard/
        ├── PositionCard.tsx    (render: veMEZO balance, allocation summary)
        └── EpochCountdown.tsx  (render: countdown timer + progress bar)
```

---

## Acceptance criteria

```gherkin
Given the wallet is connected and has a veMEZO position
When the Dashboard is shown
Then PositionCard displays my veMEZO balance in human-readable format

Given I have a current gauge allocation
When PositionCard is shown
Then it shows a summary: "Allocated: X gauges"

Given the current block time is known from wagmi
When the Dashboard is shown
Then EpochCountdown displays "X days, Y hours, Z minutes until next epoch"
And a progress bar fills from 0–100% over the epoch duration

Given the wallet is NOT connected
When the Dashboard is shown
Then PositionCard shows "Connect wallet to see your position"
And EpochCountdown still shows the countdown (it's not user-specific)

Given the epoch just ended (countdown < 1 minute)
Then EpochCountdown shows "Epoch renews in <1 min" (not negative)
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/app build   # must exit 0
```

---

## Constraints

- veMEZO balance read via wagmi `useReadContract` from the deployed MezoYield contract
- Epoch duration: hard-coded to 1 week (604800 seconds) — verify from Mezo docs
- Block timestamp comes from wagmi `useBlock()` hook
- Never show raw wei — convert to decimal (18 decimals for veMEZO)
- §14: No hardcoded balances or test data
- EpochCountdown must be a real countdown, not a static "next epoch in 7 days"
