# MezoYield — Prior Art Research
**Date:** 2026-04-30

---

## 1. Convex Finance
**GitHub:** https://github.com/convex-eth/platform  
**Stack:** Solidity, TypeScript | **License:** MIT | **Status:** Actively maintained  
Foundational model for gauge voting optimization on Curve. Boost optimizer using locked CVX tokens. Key patterns: Booster contract (aggregates gauge positions), VoterProxy (vote delegation), BaseRewardPool (reward distribution). Directly applicable to veBTC/veMEZO mechanics.

## 2. Aura Finance
**GitHub:** https://github.com/aurafinance/aura-contracts  
**Stack:** Solidity, TypeScript, Hardhat | **License:** MIT | **Status:** Actively maintained  
Convex equivalent for Balancer. Proves the boost-optimizer pattern scales to other gauge systems. Uses ERC-4626 vault wrappers per gauge, multi-fee-distro handling, Snapshot integration via EIP-1271. Architecture lesson: wrap each gauge as a vault.

## 3. Votium
**GitHub:** https://github.com/oo-00/Votium  
**Stack:** Solidity, JS/TS | **License:** Open source | **Status:** Historical (2021–2023)  
Pioneer bribe marketplace for Curve gauges. Merkle-tree-based reward distribution, bi-weekly bribe cycles, multi-asset reward support. Direct reference for epoch-based bribe claim mechanics.

## 4. Hidden Hand / Redacted Cartel
**GitHub:** https://github.com/dinero-protocol/hidden-hand-contracts  
**Stack:** Solidity, TypeScript, Hardhat | **License:** MIT | **Status:** Active (2024–2025)  
Generalized bribe marketplace (Curve, Balancer, others). BribeVault + BribeMarket + RewardDistributor with merkle proof claims. Protocol-agnostic design. 4% fee model. Best reference for multi-round bribe auction mechanics.

## 5. Boar Finance (Mezo Ecosystem)
**GitHub:** Not public (deployed at boar.network)  
**Status:** Live on Mezo — the closest direct competitor  
Non-custodial veBTC delegation, epoch-based rebalancing, Matchbox marketplace integration, auto-compound. Proves product-market fit on Mezo. MezoYield differentiates via: better analytics, historical performance charts, dual veBTC+veMEZO optimization, and cleaner UX.

## 6. Matchbox (Mezo Bribe Marketplace)
**Status:** Live on Mezo — community built  
Mezo's equivalent to Hidden Hand/Votium. MezoYield must display live Matchbox incentive data and recommend vote allocations based on real-time bribe prices. Integration is mandatory for relevance.

## 7. Mezo Core (mezo-org/musd)
**GitHub:** https://github.com/mezo-org/musd  
**Stack:** TypeScript, Solidity | **Commits:** 1,434+ | **Status:** Actively maintained  
ve(3,3) tokenomics: veMEZO boosts veBTC up to 5x, weekly epoch gauges distribute MEZO emissions. Gauge system is in the musd repo. Must read contracts before writing vote-delegation code.

---

## Key design constraints from prior art

1. Weekly epoch cadence (not bi-weekly like Curve) — UX must reflect this
2. Dual-token system (veBTC + veMEZO, 5x boost) — optimizer must model both
3. Merkle claim distribution is the standard (Votium/Hidden Hand pattern)
4. ERC-4626 wrappers per gauge (Aura pattern) is worth evaluating for deposit flow
5. Matchbox is the live bribe marketplace — surface its data in the dashboard
6. MIT license is the ecosystem standard — use it
7. Boar exists but has no open analytics layer — that's MezoYield's differentiation wedge
