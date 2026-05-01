# Sponsor Docs — Mezo Primitives, SDKs, APIs, Testnet

**Sponsor:** Mezo (mezo.org)  
**GitHub:** github.com/mezo-org/  
**Docs:** mezo.org/docs/developers/  

---

## What Is Mezo?

Mezo is a Bitcoin-native **EVM-compatible sidechain** designed as the "Bitcoin economic layer." Key architecture facts:

- **Chain type:** EVM-compatible blockchain (NOT Ethereum L2 — it's a sidechain)
- **Core client:** `mezod` — a heavily modified fork of Evmos, built on Cosmos SDK + CometBFT consensus
- **Gas token:** BTC (all transaction fees on Mezo are paid in BTC)
- **Bridge:** tBTC via Threshold Network (trust-minimized Bitcoin bridge; ~$400M in DeFi activity)
- **Stablecoin:** MUSD — 100% BTC-backed CDP stablecoin (like Liquity but for Bitcoin)
- **Token:** MEZO — ve-tokenomics coordination/multiplier token (launched Jan 26, 2026)
- **Yield system:** Mezo Earn — veBTC (lock BTC) earns BTC-denominated fees; veMEZO boosts up to 5x
- **Builder:** Thesis* (same team behind tBTC/Threshold Network)

---

## What is MUSD?

MUSD is Mezo's native **Bitcoin-backed stablecoin**:

- **Mechanism:** Collateralized Debt Position (CDP) — deposit BTC collateral, mint MUSD
- **Backing:** 100% Bitcoin (via tBTC)
- **Borrow rate:** Fixed 1–5% APR for the life of the loan
- **Min collateralization ratio:** 110% (more capital-efficient than Aave's 82.5% for ETH)
- **Peg maintenance:** Mint/redeem arbitrage + Stability Pool + Redistribution Mechanics
- **Redemption fee:** 0.5% (for users without existing loan position)
- **Smart contracts:** github.com/mezo-org/musd (Solidity + TypeScript dApp)
- **Mainnet status:** LIVE (deployed on Mezo mainnet)
- **MUSD on Bullish Exchange:** LIVE as of April 2026

### MUSD Savings Rate (Gauge)
MUSD holders can deposit into the Savings Rate staking module to earn:
- Mezo chain fees (BTC-denominated)
- MEZO emissions (determined by veBTC gauge votes)

---

## What is MEZO Token?

MEZO is the ve-tokenomics coordination and amplification token:

- **Total supply:** 1,000,000,000 MEZO at genesis
- **TGE date:** January 26, 2026
- **Lock for:** veMEZO — boosts veBTC earnings up to 5x
- **Max lock:** [UNVERIFIED exact duration]
- **Distribution:** 40% Community, 30% Investors/Partners, 20% Team, 10% Foundation
- **Listed on:** Bullish Exchange (April 2026); Aerodrome (Base chain)
- **Emission model:** Bitcoin-inspired halving (25% → 12.5% → ... → 2% terminal)

### veBTC
- Lock BTC on Mezo → receive veBTC (time-weighted voting power)
- veBTC earns BTC-denominated fees from chain activity (bridging, swap, MUSD interest)
- Max lock: 30 days (short by design)

---

## @mezo-org/passport

**What it is:** Official wallet connection library for Mezo dApps — built on top of RainbowKit  

**What it does:**
- Enables connection of **native Bitcoin wallets** (Xverse, Unisat) AND standard EVM wallets (MetaMask, RainbowKit)
- Provides `getConfig()` and `mezoTestnet` / `mezoMainnet` chain configs
- Wraps WagmiProvider configuration for Mezo chains
- Also includes `@mezo-org/orangekit` dependency (1.0.0-beta.36-dev.2) — Bitcoin wallet connector layer

**Version:** 0.1.0-dev.1 (dev version; latest stable is 0.17.2 based on CDN references)  
**License:** GPL-3.0-only  
**Maintainers:** Thesis.co team (Dmitry Paremski, Piotr Dyraga, Lukasz Zimnoch, etc.)  
**Repo:** github.com/mezo-org/passport  

**Installation:**
```bash
npm install @mezo-org/passport @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

**Basic setup:**
```typescript
import { getConfig, mezoTestnet } from "@mezo-org/passport";

// Use getConfig() to configure WagmiProvider
// Supports Bitcoin wallets (Unisat, Xverse) + EVM wallets out of the box
const config = getConfig({ appName: "Your Mezo dApp" });
```

> **NOTE:** In 2025 hackathon, @mezo-org/passport integration was explicitly required (30% judging weight on "Mezo Integration" included Passport use). For 2026 hackathon, docs say passport is "optional and not required to build on Mezo" — but it was the flagship UX requirement in 2025. Verify whether it's still in judging criteria for 2026.

---

## Network Details

### Testnet
| Parameter | Value |
|-----------|-------|
| Network Name | Mezo Testnet |
| RPC (HTTPS) | https://rpc.test.mezo.org |
| RPC (WSS) | wss://rpc-ws.test.mezo.org |
| Chain ID | 31611 |
| Native Currency | BTC |
| Decimals | 18 |
| Block Explorer | https://explorer.test.mezo.org |
| Faucet | https://faucet.test.mezo.org |

### Mainnet
| Parameter | Value |
|-----------|-------|
| Network Name | Mezo Mainnet |
| Chain ID | 31612 |
| Native Currency | BTC |
| Block Explorer | https://explorer.mezo.org |

### Mainnet RPC Providers
| Provider | HTTPS | WSS |
|----------|-------|-----|
| Boar | https://rpc-http.mezo.boar.network | wss://rpc-ws.mezo.boar.network |
| Imperator | https://rpc_evm-mezo.imperator.co | wss://ws_evm-mezo.imperator.co |
| Validation Cloud | https://mainnet.mezo.public.validationcloud.io | wss://mainnet.mezo.public.validationcloud.io |
| dRPC NodeCloud | https://mezo.drpc.org | wss://mezo.drpc.org |

---

## Developer Tooling

### Hardhat Config (Testnet)
```javascript
module.exports = {
  defaultNetwork: "mezotestnet",
  networks: {
    mezotestnet: {
      url: "https://rpc.test.mezo.org",
      chainId: 31611,
      accounts: ["YOUR_PRIVATE_WALLET_KEY"]
    }
  },
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "london",
      optimizer: { enabled: true, runs: 200 }
    }
  }
};
```

**Foundry:** Also supported. See mezo.org/docs/developers/getting-started/configure-environment for full config.

---

## GitHub Repos (mezo-org)

| Repo | Description | Language | Stars |
|------|-------------|----------|-------|
| musd | Smart contracts + dApp for MUSD | TypeScript/Solidity | 17 |
| mezod | Reference client for Mezo chain | Go | 13 |
| documentation | Official docs | MDX | 11 |
| validator-kit | Tools for running validator nodes | Shell | 10 |
| safe-deployments | Forked Safe singleton deployments | TypeScript | 6 |
| go-ethereum | Forked go-ethereum | Go | 5 |
| audits | Security audits collection | — | 0 |
| keep-common | Forked Keep Network common libs | Go | 0 |
| homebrew-tap | CLI package distributions (macOS/Win) | Ruby | 0 |
| AllocationsRaw | Airdrop allocation data | — | 0 |
| passport | Wallet connection SDK (separate from main org listing) | TypeScript | — |

**Key for builders:**
- `mezo-org/musd` — the core lending protocol; Solidity contracts + dApp
- `mezo-org/validator-kit` — Docker/Helm/native validator setup
- `mezo-org/passport` — wallet connection SDK

---

## Smart Contract Primitives Available

Based on MUSD protocol (from docs and winners from prior hackathon):

1. **MUSD Minting/Borrowing** — Deposit BTC (tBTC), mint MUSD at 110% min CR
2. **Stability Pool** — Deposit MUSD, earn BTC collateral from liquidations
3. **veBTC Gauges** — Vote on fee/emission distribution
4. **MUSD Savings Rate** — Stake MUSD for BTC fees + MEZO emissions
5. **LP Pools (Tigris)** — Mezo's native AMM for BTC/MUSD pairs
6. **Keeper infrastructure** — Liquidation bots, redemption automation (winner from 2025: TrovePilot)
7. **ERC-1155 tokens** — Used for membership passes (CreatorBank winner)
8. **Pyth oracle** — Price feeds used on Mezo (referenced in winners)

---

## What's Live on Mainnet (as of April 2026)

- MUSD minting/borrowing — LIVE
- MUSD Savings Vault (sMUSD) — LIVE
- Mezo Earn (veBTC locking, veMEZO boosting) — LIVE
- BTC + stablecoin vaults (via Upshift Finance / Sense / Perseus) — LIVE
- LP pools on Mezo — LIVE
- MEZO token — LIVE (launched Jan 26, 2026; listed on Bullish Exchange April 2026)
- Triparty Bridge (Mezo Client v9) — LIVE (April 2026)
- Mezo Prime (institutional vaults via Anchorage Digital) — LIVE (April 2026)

---

## Context7 Check

[UNVERIFIED — context7 was not queried for Mezo/mezo-org passport SDK. The npm registry data and GitHub repo structure confirm the SDK is TypeScript/wagmi/viem based. No dedicated Context7 docs page found for Mezo.]

---

## Key Docs Pages

- Developer Getting Started: https://mezo.org/docs/developers/getting-started/
- MUSD docs: https://mezo.org/docs/users/musd/mint-musd
- Mezo Earn overview: https://mezo.org/docs/users/mezo-earn/overview
- Configure Environment: https://mezo.org/docs/developers/getting-started/configure-environment
- Earn Whitepaper: https://mezo.org/docs/Mezo_Earn_Whitepaper.pdf
