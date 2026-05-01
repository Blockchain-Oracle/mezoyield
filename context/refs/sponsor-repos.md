# Sponsor Repos — Mezo (mezo-org)

All repos are under github.com/mezo-org/

---

## Primary Builder Repos

### musd — Core MUSD Protocol
```bash
git clone https://github.com/mezo-org/musd.git
```
- **What:** Smart contracts (Solidity) + dApp (TypeScript/React) for MUSD stablecoin
- **License:** GPL-3.0
- **Stars:** 17
- **Setup:**
  ```bash
  pnpm install --frozen-lockfile
  cd solidity
  pnpm install --frozen-lockfile
  pnpm test    # run contract tests
  pnpm run deploy  # deploy to Mezo testnet
  ```
- **Key contracts:** BorrowerOperations, StabilityPool, TroveManager, MUSD token

### passport — Wallet Connection SDK
```bash
git clone https://github.com/mezo-org/passport.git
```
- **What:** RainbowKit-based wallet connector supporting Bitcoin wallets (Xverse, Unisat) + EVM wallets
- **NPM:** `@mezo-org/passport`
- **Current dev version:** 0.1.0-dev.1 (npm), 0.17.2 (cdn/latest)
- **License:** GPL-3.0-only
- **Setup:**
  ```bash
  cd typescript/passport
  npm install
  npm run build
  ```

### mezod — Chain Client
```bash
git clone https://github.com/mezo-org/mezod.git
```
- **What:** Reference implementation for Mezo chain (Go, based on Evmos/Cosmos SDK)
- **License:** LGPL-3.0
- **Stars:** 13
- **Use case:** Run a full node, understand chain internals, contribute to core

### documentation — Official Docs
```bash
git clone https://github.com/mezo-org/documentation.git
```
- **What:** MDX documentation source for mezo.org/docs
- **License:** GPL-3.0
- **Stars:** 11
- **Use case:** Local docs browsing, understanding full API surface

### validator-kit — Validator Setup
```bash
git clone https://github.com/mezo-org/validator-kit.git
```
- **What:** Tools + documentation for running Mezo validator nodes
- **License:** Unlicensed
- **Stars:** 10
- **Deployment options:** Docker Compose (recommended), native binary, Helm (Kubernetes), Manual

### audits — Security Audits
```bash
git clone https://github.com/mezo-org/audits.git
```
- **What:** Collection of security audit reports for Mezo contracts
- **Use case:** Understanding what's been reviewed, attack vectors considered

### safe-deployments — Gnosis Safe
```bash
git clone https://github.com/mezo-org/safe-deployments.git
```
- **What:** Forked from safe-global/safe-deployments — Safe contract addresses on Mezo
- **Use case:** Multi-sig wallet deployments on Mezo chain

### go-ethereum — Mezo's go-ethereum Fork
```bash
git clone https://github.com/mezo-org/go-ethereum.git
```
- **What:** Forked Ethereum go-ethereum for Mezo chain internals

---

## Supporting Repos

| Repo | Purpose | Notes |
|------|---------|-------|
| keep-common | Common libraries from Keep Network (tBTC infrastructure) | Forked from keep-network/keep-common |
| homebrew-tap | Package distributions for mezo-cli (macOS/Win/Linux) | Homebrew/Scoop/Chocolatey/AUR/APT |
| AllocationsRaw | Airdrop allocation raw data | MEZO airdrop data |

---

## Key External Repos from 2025 Winners (for reference)

These are prior hackathon winners that can be studied:

| Project | Repo | Track |
|---------|------|-------|
| TrovePilot | github.com/VitalR/mezo-trovepilot | Advanced DeFi |
| BTCShield | github.com/MananSinghal123/BTCShield | Advanced DeFi |
| StratumFi | github.com/Ghost-xDD/Stratum-FI | Advanced DeFi |
| KhipuVault | github.com/AndeLabs/khipuvault | Financial Access |
| BitSpend | github.com/Cannon07/BitSpend | Financial Access |
| CreatorBank | github.com/syntaxsurge/creator-bank | Financial Access |
| Invoiced | github.com/Invoiced-Mezo-Hackathon/invoiced-dashboard | Daily Bitcoin |
| BountyPay | github.com/lucci-xyz/bounty | Daily Bitcoin |
| MezoLotto | github.com/AllenAJ/MezoLotto | Daily Bitcoin |

---

## Technical Partner Resources

| Partner | Resource |
|---------|----------|
| Boar Network | RPC: https://rpc-http.mezo.boar.network — Starter pack for hackathon (LinkedIn post) |
| Validation Cloud | RPC: https://mainnet.mezo.public.validationcloud.io |
| Tenderly | Transaction simulation/debugging — check Tenderly dashboard for Mezo support |
| Goldsky | Subgraph indexing — check goldsky.com for Mezo chain support |
| Enigma | [UNVERIFIED — role unclear] |
| Spectrum | [UNVERIFIED — validator/mentor] |
| Sats Ventures | [UNVERIFIED — sponsor/investor] |
