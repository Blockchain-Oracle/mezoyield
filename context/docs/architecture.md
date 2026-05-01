# Architecture — MezoYield
**Version:** 1.0 — 2026-04-30

---

## Stack decision

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | Standard in Mezo ecosystem (MezoStream used it); Vercel deploy is 1-command |
| UI components | shadcn/ui + Tailwind CSS | Anchor product uses it; agent knows it cold |
| Wallet | Mezo Passport + wagmi v2 + viem | **Mandatory per hackathon rules**; wagmi is the standard for hooks |
| Contracts | Solidity 0.8.x | EVM-compatible, Mezo testnet target |
| Contract testing | Hardhat + chai | Standard; mezo-org/musd uses Hardhat |
| Contract deploy | Hardhat deploy scripts | Target: Mezo Testnet (Chain ID 31611) |
| Data | Goldsky subgraph (sponsor) | Gauge/emission data indexing — Goldsky is a hackathon sponsor |
| Monorepo | pnpm workspaces | `packages/contracts`, `packages/app` |
| CI | None for hackathon (green-light.sh is the gate) | Simplicity over infra |

---

## Repository structure

```
mezoyield/
├── packages/
│   ├── contracts/          # Hardhat project
│   │   ├── contracts/
│   │   │   ├── MezoYieldOptimizer.sol   # Core: vote delegation + auto-allocation
│   │   │   └── interfaces/
│   │   │       ├── IGaugeController.sol
│   │   │       └── IMatchbox.sol
│   │   ├── scripts/deploy.ts
│   │   ├── test/
│   │   │   └── MezoYieldOptimizer.test.ts
│   │   └── hardhat.config.ts
│   └── app/                # Next.js 14 app
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx            # SPA root — dashboard
│       │   └── providers.tsx       # Passport + wagmi setup
│       ├── components/
│       │   ├── Dashboard/
│       │   │   ├── GaugeBoard.tsx
│       │   │   ├── PositionCard.tsx
│       │   │   ├── EpochCountdown.tsx
│       │   │   └── YieldChart.tsx
│       │   ├── OptimizeModal.tsx
│       │   └── ClaimButton.tsx
│       ├── hooks/
│       │   ├── useVeMezoPosition.ts
│       │   ├── useGaugeData.ts
│       │   └── useAutoOptimize.ts
│       └── lib/
│           ├── wagmi.ts
│           ├── passport.ts
│           └── subgraph.ts
├── .claude/
│   ├── settings.json
│   └── scripts/
│       └── green-light.sh
├── CLAUDE.md
├── SPEC.md                 # Written per ticket by orchestrator
└── package.json
```

---

## Contract design — MezoYieldOptimizer.sol

**Scope:** Non-custodial. The contract never holds user funds or votes. It computes the optimal allocation off-chain and submits a vote on behalf of the user's delegated veMEZO.

```solidity
interface IMezoYieldOptimizer {
    // User delegates voting power to this contract
    function delegate(address user) external;
    
    // Submit optimized allocation for current epoch (called by keeper or user)
    function castOptimalVote(
        address[] calldata gauges,
        uint256[] calldata weights   // basis points, sum = 10000
    ) external;
    
    // Manual override — user sets their own allocation
    function setManualAllocation(
        address[] calldata gauges,
        uint256[] calldata weights
    ) external;
    
    // View: current allocation for address
    function getAllocation(address user) external view returns (
        address[] memory gauges,
        uint256[] memory weights
    );
    
    // Claim rewards (forwards to Matchbox claim)
    function claimRewards(address user) external;
}
```

**ADR-1: Gauge allocation computed off-chain, submitted on-chain**  
Reason: Matchbox bribe data is off-chain (or via subgraph). Computing optimal allocation in Solidity would require oracle integration adding scope. For hackathon MVP, the frontend computes the optimal allocation and the contract executes the vote. Security note in CLAUDE.md: user must approve the allocation before it's submitted.

**ADR-2: Mezo Passport for all wallet interactions**  
Reason: Mandatory hackathon requirement. Use `@mezo-org/passport` npm package.

**ADR-3: Goldsky subgraph for gauge data**  
Reason: Goldsky is a hackathon sponsor. Using their indexing earns sponsor points and reduces on-chain reads.

**ADR-4: SPA layout, not multi-route dashboard**  
Reason: Baked into hackathon-playbook.md §12 — demo punch requires focus. One page with mode toggle (Dashboard ↔ Optimize).

---

## Mezo Testnet config

```typescript
export const mezoTestnet = {
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'tBTC', symbol: 'tBTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.test.mezo.org'] },
  },
  blockExplorers: {
    default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' },
  },
}
```

---

## Key external dependencies

| Package | Version | Purpose |
|---|---|---|
| `@mezo-org/passport` | latest | Wallet connection (mandatory) |
| `wagmi` | v2 | React hooks for EVM |
| `viem` | v2 | Low-level EVM |
| `hardhat` | latest stable | Contract compile + test + deploy |
| `@graphql-request` | latest | Goldsky subgraph queries |
| `recharts` | latest | Yield history chart |
| `shadcn/ui` | latest | UI components |

---

## What the coding agent must NOT do

- Do not use mock/fake/dummy gauge data in the hot path (§14)
- Do not hardcode gauge addresses — read from deployed registry or subgraph
- Do not use ethers.js — viem only
- Do not invent a new design — follow the anchor product and CLAUDE.md tokens
- Do not add routes beyond the SPA root — mode toggle only
