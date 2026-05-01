# Competitor Analysis — Adjacent Projects & Incumbents

## Landscape: Bitcoin-Backed Stablecoin & DeFi on Bitcoin

Mezo occupies a specific niche: **Bitcoin collateral → stablecoin borrowing → EVM dApp platform**. Here's who's in the same space and what they're doing differently.

---

## Direct Protocol Competitors to Mezo Itself

### 1. Liquity (Ethereum)
- **What:** CDP stablecoin (LUSD) with 0% interest, 110% min CR
- **Similarity:** Mezo MUSD is architecturally similar (Liquity-style CDP); Mezo took the CR model from Liquity
- **Difference:** Liquity uses ETH as collateral; Mezo uses BTC (tBTC). Mezo adds ve-tokenomics layer
- **Status:** Liquity v2 now live on Ethereum

### 2. Babylon (Bitcoin Staking)
- **What:** Bitcoin staking protocol enabling BTC to secure PoS chains
- **Similarity:** Both enable BTC to "do more"
- **Difference:** Babylon is about BTC staking/security; Mezo is about BTC-backed lending/spending

### 3. Stacks (Bitcoin L2)
- **What:** Smart contracts on Bitcoin (PoX consensus)
- **Similarity:** Both are Bitcoin DeFi platforms
- **Difference:** Stacks is a true L2 anchored to Bitcoin; Mezo is a sidechain. Note: Velar (a Stacks dApp) was exploited on Mezo's chain in Feb 2026 — there's ecosystem overlap
- **Relevance:** Builders familiar with Stacks may be hackathon participants

### 4. Rootstock (RSK)
- **What:** Bitcoin-anchored EVM sidechain with merge mining
- **Similarity:** Both are EVM-compatible Bitcoin sidechains
- **Difference:** RSK uses merged mining; Mezo uses PoA validators. RSK has been live since ~2018 — more mature but less DeFi-native

### 5. BOB (Build on Bitcoin)
- **What:** Bitcoin L2 with EVM compatibility + native BTC bridge
- **Similarity:** EVM + BTC focus
- **Difference:** BOB is an Ethereum L2 rollup anchored to Bitcoin; Mezo is a standalone sidechain

---

## Competing Hackathon Tracks (What Builders Might Build)

### Bitcoin-backed stablecoins
- **Incumbent:** sBTC (Stacks), pBTC (pNetwork), eBTC (Liqity/dApp)
- **On Mezo's turf:** MUSD is Mezo-native; builders adding MUSD yield products, savings, or payments add to this ecosystem rather than compete
- **Field status for 2025 winners:** TrovePilot (keeper automation), BTCShield (options on positions), StratumFi (self-repaying loans) — these are additive protocol layer projects

### Bitcoin payment apps
- **Incumbents:** BTCPay Server (open source BTC invoicing), Strike (Lightning payments), Wallet of Satoshi (Lightning)
- **On Mezo:** Using MUSD for payments vs. Lightning for payments — different tradeoffs (stability vs. speed). Lightning is more mature for P2P payments but MUSD enables "spend without selling BTC" at stable value

### Bitcoin-backed lending
- **Incumbents:** Aave (variable rate, ETH-heavy), Compound, Morpho (Ethereum)
- **Mezo advantage:** Fixed rate (1% vs 8-9% variable on Aave), BTC-native collateral, self-custody

### LATAM / emerging market savings
- **Incumbents:** Angle Protocol (agEUR), crvUSD on Curve, generic USDC savings
- **KhipuVault (2025 winner):** BTC-backed savings cooperatives for LATAM — direct competitors are traditional ROSCAs, savings circle apps

### Creator payment tools
- **Incumbents:** Gig Platform payouts (PayPal, Stripe), Request Network, Superfluid (EVM streaming)
- **CreatorBank (2025 community choice):** MUSD-based creator toolkit — competing with general-purpose payment infra

---

## What Projects Win at Mezo Hackathons

From 2025 results pattern analysis:

| Pattern | Example Project | Why It Wins |
|---------|----------------|-------------|
| Infrastructure for core protocol | TrovePilot (keeper automation) | Makes MUSD peg safer; judges love protocol health |
| Real-world payments utility | Invoiced, BitSpend, BountyPay | Shows MUSD as money for normal workflows |
| Geographic/demographic focus | KhipuVault (LATAM) | Mezo cares about financial inclusion narrative |
| DeFi composability | StratumFi (self-repaying loans) | Shows MUSD as "money lego" |
| Consumer UX | MezoLotto (no-loss lottery) | Makes DeFi accessible |

**Key judge signal:** Projects are judged on whether they make MUSD the settlement currency / default unit in real workflows. Mezo wants MUSD to be the "base money" of its ecosystem.

---

## What's Notably Absent (Potential Whitespace)

Areas from 2025 that weren't covered:
- **veMEZO / Governance tooling** — no dedicated governance dashboard winner in 2025
- **Cross-chain MUSD** — 2026 roadmap mentions cross-chain MUSD expansion; no hackathon project yet
- **DeFi money markets on MUSD** — lending MUSD itself (vs. borrowing it)
- **NFT collateral** — using NFTs as collateral for MUSD loans
- **Agent-based yield optimization** — automated veBTC voting and gauge management
- **Perp DEX on MUSD** (Velar tried this but got exploited — space is open)
- **Institutional tools** — Mezo Prime launched April 2026 with Anchorage Digital; dashboard for institutions

---

## Comparable Protocols for ve-Tokenomics Research

| Protocol | Model | Relevance |
|----------|-------|-----------|
| Curve Finance | veCRV — original ve model | Mezo Earn is inspired by this |
| Aerodrome (Base) | ve(3,3) — simplified, full fee distribution | Closest model to Mezo Earn; MEZO/MUSD pool on Aerodrome |
| Convex Finance | CVX — boost layer on Curve | Conceptually similar to what a boost optimizer could do on Mezo |
| Alchemix | Self-repaying loans from yield | StratumFi (2025 winner) reproduced this on Mezo |
