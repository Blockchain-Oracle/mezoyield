# STORY-003 — MezoYieldOptimizer.sol + tests

**Epic:** EPIC-2: Core contract  
**Priority:** P0  
**Depends on:** STORY-001  
**Estimated effort:** 2h

---

## User story

As MezoYield,  
I want a smart contract that accepts vote delegation, stores allocations, and forwards reward claims,  
So that user voting power can be auto-managed on-chain without the user holding custody.

---

## File modification map

```
packages/contracts/
├── contracts/
│   ├── MezoYieldOptimizer.sol
│   └── interfaces/
│       ├── IGaugeController.sol    (Mezo gauge interface — methods: vote_for_gauge_weights)
│       └── IMatchbox.sol           (Matchbox interface — methods: claim)
├── test/
│   └── MezoYieldOptimizer.test.ts
└── scripts/
    └── deploy.ts                   (stub — no testnet deploy yet, that's STORY-004)
```

---

## Acceptance criteria

```gherkin
Given a user has approved delegation to the optimizer
When they call `delegate(userAddress)`
Then `isDelegated(userAddress)` returns true

When they call `setManualAllocation([gaugeA, gaugeB], [6000, 4000])`
Then `getAllocation(userAddress)` returns those gauges and weights
And the weights sum to 10000 (basis points)

When a keeper calls `castOptimalVote([gaugeA, gaugeB], [7000, 3000])`
Then the contract emits `VoteCast(gauges, weights)`
And the weights sum to 10000

When weights do NOT sum to 10000
Then the transaction reverts with "weights must sum to 10000"

When a non-keeper calls `castOptimalVote`
Then the transaction reverts with "not authorized"

When `claimRewards(userAddress)` is called
Then it forwards the call to the Matchbox IMatchbox interface
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/contracts test   # must exit 0, all cases pass
pnpm --filter @mezoyield/contracts build  # must exit 0
```

---

## Constraints

- Solidity ^0.8.20
- Non-custodial: the contract NEVER holds user funds
- Keeper role: only the deployer (or a whitelisted address) can call `castOptimalVote`
- All state reads are `view` functions — no gas on reads
- IGaugeController and IMatchbox should have minimal interface stubs — do not invent full implementations
- Do not deploy in this story — deploy is STORY-004
- Test must use Hardhat + chai (no foundry)
- §14: No mock/fake/dummy data in the contract's hot path
