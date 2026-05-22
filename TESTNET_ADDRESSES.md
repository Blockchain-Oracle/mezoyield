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

## Testnet contracts (v3 — per-user fan-out)

| Slot                  | Address                                       | Real contract                | Block      |
|-----------------------|-----------------------------------------------|------------------------------|------------|
| `MezoYieldOptimizer`  | `0x62Bc24173cE545b751f095563716E93819d5740e`  | `MezoYieldOptimizer`         | `13205245` |
| `MockGaugeController` | `0x2d413D8267b9ab5DE06C8588da66d1Caff337544`  | `MockGaugeController` (mock) | `13205242` |
| `MockMatchbox`        | `0x3A8B5b22A3a433e3f31359c796e542221F48aB38`  | `MockMatchbox` (mock)        | `13205243` |
| `MockVeMezo`          | `0xFe5C3420784C6F312fD5977FFfb7Af616C7dEb75`  | `MockVeMezo` (mock)          | `13205244` |

[Optimizer](https://explorer.test.mezo.org/address/0x62Bc24173cE545b751f095563716E93819d5740e) · [MockGaugeController](https://explorer.test.mezo.org/address/0x2d413D8267b9ab5DE06C8588da66d1Caff337544) · [MockMatchbox](https://explorer.test.mezo.org/address/0x3A8B5b22A3a433e3f31359c796e542221F48aB38) · [MockVeMezo](https://explorer.test.mezo.org/address/0xFe5C3420784C6F312fD5977FFfb7Af616C7dEb75)

## Mainnet contracts (v3)

| Slot                  | Address                                       | Real contract                                  | Notes |
|-----------------------|-----------------------------------------------|------------------------------------------------|-------|
| `MezoYieldOptimizer`  | _see `deployments/mezo-mainnet.json`_         | `MezoYieldOptimizer`                           | redeployed each canonical run |
| `MockGaugeController` | _see manifest_                                | `BoostVoterAdapter` (wraps real BoostVoter)    | slot named for shape compat |
| `MockMatchbox`        | `0xdB2CB451fBCfa232d97d5De878F17Cc3F2b10535`  | `MatchboxAdapter` (5 tracked gauges, seeded bribes) | preserved across redeploys |
| `MockVeMezo`          | `0x2d413D8267b9ab5DE06C8588da66d1Caff337544`  | `VeMezoVotingPower` (sums NFT voting power)    | preserved across redeploys |

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
