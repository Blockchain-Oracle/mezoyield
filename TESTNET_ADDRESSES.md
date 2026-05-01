# Testnet Addresses

## Network

| Field        | Value                                              |
|--------------|----------------------------------------------------|
| Chain name   | Mezo Testnet                                       |
| Chain ID     | `31611`                                            |
| RPC endpoint | `https://rpc.test.mezo.org`                        |
| Explorer     | `https://explorer.test.mezo.org`                   |
| Faucet       | `https://faucet.test.mezo.org`                     |
| Deployed at  | `2026-05-01T18:52:04.908Z` (UTC)                   |
| Deployer EOA | `0x84f94745ea0a434540749839819E65E281970004`       |

The deployment manifest is the on-disk source of truth at `packages/contracts/deployments/mezo-testnet.json` — that file is loaded by `packages/app/lib/contracts.ts`, which is what the frontend reads at runtime. Update the manifest, the app picks it up automatically.

## Contracts

| Contract              | Address                                       | Deployment tx                                                          | Block      |
|-----------------------|-----------------------------------------------|------------------------------------------------------------------------|------------|
| `MezoYieldOptimizer`  | `0x1A9a4f8279F88a1551117766957DB23A35133B6D`  | `0x05095dc0ec8c1385c6b648f994899b094870ae78a8541ec6c12d6163cc63b4b5`   | `12758568` |
| `MockGaugeController` | `0xB2f5cBbf2401F4F74F3E4d9FaCb3C4b7c1897140`  | `0xe1c61060c21490db409effb068ceee50b89841edd91250b4ab3fe3cc63965eba`   | `12758565` |
| `MockMatchbox`        | `0x5C86Aa4Cc0aff9f4AA9751671eE946dc4Dc07431`  | `0xd2c5115052416bc684fc0bf1fe48828196306951973c21fb0644a42cbce86d5e`   | `12758566` |
| `MockVeMezo`          | `0x5351665b6805B35e0ba3C7522e62e7E3EEEeA2d6`  | `0x9f07a2386723dcd12bc4ca1143dbfdfed22f6857e3649b747c2cc0556a7d4305`   | `12758567` |

Each address links to the testnet explorer once visited:

- [`MezoYieldOptimizer`](https://explorer.test.mezo.org/address/0x1A9a4f8279F88a1551117766957DB23A35133B6D)
- [`MockGaugeController`](https://explorer.test.mezo.org/address/0xB2f5cBbf2401F4F74F3E4d9FaCb3C4b7c1897140)
- [`MockMatchbox`](https://explorer.test.mezo.org/address/0x5C86Aa4Cc0aff9f4AA9751671eE946dc4Dc07431)
- [`MockVeMezo`](https://explorer.test.mezo.org/address/0x5351665b6805B35e0ba3C7522e62e7E3EEEeA2d6)

## Why are there mock contracts?

Mezo has not yet published canonical mainnet addresses for the gauge controller, matchbox (bribe distributor), or veMEZO token. The judge-facing demo therefore deploys testnet stand-ins so the application can call real on-chain code end-to-end (per the "no teeth = no win" rule from MEZO Hack transcripts).

The real Mezo gauge system is `mezo-org/tigris`'s `Voter.sol` (Solidly-style ve-NFT). When the production addresses are published, swapping requires only an updated deployment manifest — the optimizer's `IGaugeController` and `IMatchbox` interfaces match Tigris's surface, and there's no hard-coded address in the application code.

## Seeded state

The deploy script seeded the testnet with a small dataset so the demo flow is observable without a separate setup ritual:

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

## Mainnet readiness

`packages/app/lib/contracts.ts` accepts both `chainId: 31611` (testnet) and `chainId: 31612` (mainnet) so the same source code can be retargeted by swapping the manifest. Mainnet deploy is intentionally deferred until Mezo publishes the real gauge / matchbox addresses; once they're available, the deploy script's address resolver (currently `MockGaugeController` etc.) is the only thing that needs to change.
