# MezoYield deployments

## Networks

| Field        | Testnet                                            | Mainnet                                            |
|--------------|----------------------------------------------------|----------------------------------------------------|
| Chain name   | Mezo Testnet                                       | Mezo Mainnet                                       |
| Chain ID     | `31611`                                            | `31612`                                            |
| RPC endpoint | `https://rpc.test.mezo.org`                        | `https://rpc-http.mezo.boar.network`               |
| Explorer     | `https://explorer.test.mezo.org`                   | `https://explorer.mezo.org`                        |
| Faucet       | `https://faucet.test.mezo.org`                     | n/a — real MEZO required                           |
| Deployer EOA | `0x6A6D50F25A32f79bC784F7c67Df54ce21244834c` (also the keeper)                                  | same                                                |

The deployment manifests at `packages/contracts/deployments/mezo-{testnet,mainnet}.json` are the on-disk source of truth — they're loaded by `packages/app/lib/contracts.ts` at build time based on the `NEXT_PUBLIC_MEZO_NETWORK` env var. Update the manifest, rebuild the app.

## Testnet contracts

Source of truth: `packages/contracts/deployments/mezo-testnet.json` (loaded by `packages/app/lib/contracts.ts` at build time).

| Slot                  | Address                                       | Real contract                | Block      |
|-----------------------|-----------------------------------------------|------------------------------|------------|
| `MezoYieldOptimizer`  | `0x8cB8cC254B0Aa9d9ae4e621F17E191635FF1DdF9`  | `MezoYieldOptimizer`         | `13207622` |
| `MockGaugeController` | `0xa827809897E0B8C52d5513AEfB692FB406434b8E`  | `MockGaugeController` (mock) | `13207616` |
| `MockMatchbox`        | `0xc6B0A8340e6dE6f2B675aE3116FF1800684231D5`  | `MockMatchbox` (mock)        | `13207617` |
| `MockVeMezo`          | `0x2E9A3656BEBc3D5aB761bEa9cF913C38Fc0eB99f`  | `MockVeMezo` (mock)          | `13207619` |

[Optimizer](https://explorer.test.mezo.org/address/0x8cB8cC254B0Aa9d9ae4e621F17E191635FF1DdF9) · [MockGaugeController](https://explorer.test.mezo.org/address/0xa827809897E0B8C52d5513AEfB692FB406434b8E) · [MockMatchbox](https://explorer.test.mezo.org/address/0xc6B0A8340e6dE6f2B675aE3116FF1800684231D5) · [MockVeMezo](https://explorer.test.mezo.org/address/0x2E9A3656BEBc3D5aB761bEa9cF913C38Fc0eB99f)

## Mainnet contracts

Source of truth: `packages/contracts/deployments/mezo-mainnet.json`.

| Slot                  | Address                                       | Real contract                                  | Block     |
|-----------------------|-----------------------------------------------|------------------------------------------------|-----------|
| `MezoYieldOptimizer`  | `0xCC79A460DACaB94b6e4C8cB74209488470cFAd53`  | `MezoYieldOptimizer`                           | `9133130` |
| `MockGaugeController` | `0x9811F510C87ddAcA311b41D21530c97213b2cA2A`  | `BoostVoterAdapter` (wraps real `BoostVoter`)  | `9133117` |
| `MockMatchbox`        | `0x96cDD2eD6fD82e34a747AC21d2F03637fAF69927`  | `MatchboxAdapter` (multiplexes per-gauge bribes) | `9133123` |
| `MockVeMezo`          | `0xE097c6E34C3FbfC906dF3c0C41232AED056A3b95`  | `VeMezoVotingPower` (sums NFT voting power)    | `9133121` |

[Optimizer](https://explorer.mezo.org/address/0xCC79A460DACaB94b6e4C8cB74209488470cFAd53) · [BoostVoterAdapter](https://explorer.mezo.org/address/0x9811F510C87ddAcA311b41D21530c97213b2cA2A) · [MatchboxAdapter](https://explorer.mezo.org/address/0x96cDD2eD6fD82e34a747AC21d2F03637fAF69927) · [VeMezoVotingPower](https://explorer.mezo.org/address/0xE097c6E34C3FbfC906dF3c0C41232AED056A3b95)

`external` block (real upstream Mezo contracts the adapters wrap):

| Name             | Address                                       |
|------------------|-----------------------------------------------|
| `MezoBoostVoter` | `0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1`  |
| `VeMEZO` (NFT)   | `0xb90fdAd3DFD180458D62Cc6acedc983D78E20122`  |
| `MEZO`           | `0x7B7c000000000000000000000000000000000001`  |
| `MUSD`           | `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`  |

## Testnet vs mainnet wiring delta

This is the most load-bearing fact about the codebase. **Both networks satisfy the same `IGaugeController` and `IMatchbox` interfaces, so the Optimizer source is identical.** What differs is the contract **wired into the gauge-controller slot** and the **user-flow constraints** that contract imposes.

```
TESTNET                                           MAINNET
─────────────────────────────────                ─────────────────────────────────
Keeper EOA                                       Keeper EOA
   │                                                │
   ▼                                                ▼
MezoYieldOptimizer                               MezoYieldOptimizer
   │ castOptimalVote → iterate delegated users     │  (same source code)
   │                                                │
   ▼ voteForUser(user, gauges, weights)             ▼
MockGaugeController                              BoostVoterAdapter (onlyOptimizer)
   │ records vote in mock storage                   │ checks voter has veMEZO NFT
   │ no NFT check                                   │ tokenOfOwnerByIndex(voter, 0)
   │ no approval check                              ▼
   ▼                                              real Mezo BoostVoter
   (done)                                            │ requires isApprovedOrOwner(adapter, tokenId)
                                                     ▼
                                                  records vote against tokenId
```

**Behavioral consequences for the user flow:**

| Step                         | Testnet                                   | Mainnet                                                          |
|------------------------------|-------------------------------------------|------------------------------------------------------------------|
| Get veMEZO                   | `MockVeMezo.faucet()` (mints 1000 wei)    | `VeMEZO.createLock(amount, ≥604_800s)` — locks real MEZO         |
| Approve adapter for NFT      | not required (mock skips check)           | `VeMEZO.setApprovalForAll(BoostVoterAdapter, true)` — required   |
| Delegate                     | `Optimizer.delegate(self)`                | `Optimizer.delegate(self)` — same                                |
| Keeper vote-fan-out          | hits MockGaugeController; always succeeds | hits BoostVoterAdapter → BoostVoter; reverts per-user if NFT approval missing or epoch already voted |

**Why we don't unify (per Codex round 2 + research on Tigris/MUSD patterns):** Mezo's own MUSD protocol uses `NoOp` stubs on Sepolia with explicit disclosure. Tigris uses real contracts both sides. Both patterns are industry-defensible. For MezoYield's hackathon timeline the cost-benefit of full parity (4–6 h rebuild, breaks existing testnet state) doesn't beat documenting the divergence + locking interface conformance via `test/InterfaceConformance.test.ts`. Phase G's mainnet smoke test catches the residual risk (anything the testnet flow doesn't exercise) on the real chain before demo.

## Seeded state (testnet only)

| Seed                           | Value                                  |
|--------------------------------|----------------------------------------|
| Deployer veMEZO balance        | `1500.0` veMEZO                        |
| Deployer pending MUSD reward   | `25.0` MUSD                            |
| Gauges registered              | 3 (Stability Pool, MUSD Savings Rate, BTC-MUSD LP) |

Gauge addresses are deterministic (`keccak256(name)` truncated to 160 bits), so re-running the script produces the same gauge handles even on a fresh deploy.

| Gauge name            | Address                                       | Total veMEZO (1e18)  | Bribe (MUSD, 1e18) |
|-----------------------|-----------------------------------------------|----------------------|--------------------|
| Stability Pool        | `0xd9f81562E57489c3615983cf4F55E0057971908C`  | 12_500_000           | 8_400              |
| MUSD Savings Rate     | `0x170aa1595dC03156B857201599BbFfb325Fda61b`  | 9_200_000            | 4_500              |
| BTC-MUSD LP           | `0xA6373a4c6fB851673e73cA2Ff05bC80853E40B38`  | 6_700_000            | 5_200              |

Mainnet seeds nothing automatically — see `scripts/redeploy-mainnet-canonical.ts` operational checklist for the per-user lock/approve/delegate sequence.
