# STORY-008 — Claim rewards flow

**Epic:** EPIC-4: Optimize flow  
**Priority:** P0  
**Depends on:** STORY-007  
**Estimated effort:** 1h

---

## User story

As a user with accumulated MUSD rewards from gauge allocation,  
I want to claim them with a single click,  
So that I can see my earned MUSD appear in my wallet.

---

## File modification map

```
packages/app/
├── components/
│   ├── Dashboard/
│   │   └── PositionCard.tsx      (add: "Est. reward: X MUSD/epoch" + "Claim" button)
│   └── ClaimButton.tsx           (wrap wagmi writeContract for reward claim)
└── hooks/
    └── useClaimRewards.ts        (wagmi: call MezoYieldOptimizer.claimRewards())
```

---

## Acceptance criteria

```gherkin
Given a user has allocated veMEZO and the epoch has passed
When PositionCard is shown
Then it displays "Est. pending: X MUSD" (read from contract)

When I click the "Claim" button
Then a transaction is submitted to MezoYieldOptimizer.claimRewards(userAddress)
And a loading state is shown on the button

When the transaction succeeds
Then a toast shows "Rewards claimed! +X MUSD"
And the pending amount updates to 0

When the transaction fails
Then an error toast shows the revert reason
And the user can retry

Given no pending rewards exist
Then the claim button is disabled ("No pending rewards")
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/app build   # must exit 0
```

---

## Constraints

- Pending rewards read via wagmi `useReadContract` from MezoYieldOptimizer
- Use wagmi `useWriteContract` + `useWaitForTransactionReceipt` (no polling)
- The claim function forwards to Matchbox's IMatchbox.claim() interface
- Display pending amount in human-readable MUSD (18 decimals)
- Button disabled state if pending = 0
