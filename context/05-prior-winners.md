# Prior Winners — Mezo Hackathon (Oct–Nov 2025)

**Source:** mezo.org/blog/mezo-hackathon-winners/ (published Nov 20, 2025)

The first Mezo hackathon ran October 6 – November 2, 2025 (4 weeks). Nine teams won across 3 tracks. Total prize: 37,500 MUSD.

---

## Track 1: Advanced DeFi Solutions

**Focus:** Protocol infrastructure — keeper systems, liquidation tooling, structured risk, yield mechanisms on MUSD.

### 1st Place: TrovePilot
- **Repo:** github.com/VitalR/mezo-trovepilot
- **Lead:** Vitaliy R
- **What:** Permissionless keeper automation layer for MUSD protocol actions (batch liquidations, hinted redemptions, yield routing). On-chain modular contracts + Next.js dashboard. Keepers submit jobs on-chain; rewards forwarded on-chain.
- **Why it won:** Makes peg defense more efficient; turns protocol maintenance into public infra anyone can run.

### 2nd Place: BTCShield
- **Repo:** github.com/MananSinghal123/BTCShield
- **Lead:** Manan Singhal
- **What:** Option-style protection for unhealthy loan positions. Supporters send extra collateral to at-risk positions and receive an option to take over the vault. Premium calculated from liquidation loss + safety margin.
- **Why it won:** Converts liquidation from penalty to market — adds structured products to Mezo.

### Community Choice: StratumFi
- **Repo:** github.com/Ghost-xDD/Stratum-FI
- **Lead:** Ademola Adebowale
- **What:** Alchemix-style self-repaying loans on Bitcoin. User deposits BTC → protocol provides MUSD + BTC to LP pool on Tigris → LP fees repay debt → user mints bMUSD (synthetic stablecoin 1:1 MUSD). Harvester contract routes fees to pay down debt.
- **Why it won:** Composable "money lego" — bMUSD can be used across Mezo protocols.

---

## Track 2: Financial Access & Mass Adoption

**Focus:** Tools for underbanked users, inflation-hit economies, everyday cashflow.

### 1st Place: KhipuVault
- **Repo:** github.com/AndeLabs/khipuvault
- **Team:** AndeLabs (Latin American team, active in Asoblockchain and Cochablock)
- **What:** Bitcoin-backed savings cooperatives for LATAM. Users deposit BTC → routes to MUSD on Mezo → MUSD into smart contract pools (individual savings, cooperative community pools, prize pools). Fintech-style interface hiding DeFi.
- **Markets targeted:** Bolivia, Argentina, Venezuela
- **Why it won:** Real geographic/demographic focus + shows MUSD as inflation-resistant savings in markets with weak local currencies.

### 2nd Place: BitSpend
- **Repo:** github.com/Cannon07/BitSpend
- **Lead:** Jay Shitre
- **What:** Self-custodial NFC tap-to-pay cards for MUSD payments. Private key split into 3 shares via Shamir Secret Sharing (backend DB + NFC card + user PIN). Tapping card + PIN reconstructs key, signs MUSD payment, wipes key. Daily spending limits, gas automation, merchant POS via phone.
- **Why it won:** "Tap a card, spend MUSD" — real-world payment UX while preserving self-custody.

### Community Choice: CreatorBank
- **Repo:** github.com/syntaxsurge/creator-bank
- **Lead:** Jade Laurence Empleo
- **What:** Mezo-native creator toolkit (tips, subscriptions, invoices, pay links, revenue splits) — all settling in MUSD. Uses Mezo Passport for wallet connection. ERC-1155 membership tokens. Pyth-based price stamping for on-chain receipts.
- **Why it won:** Makes MUSD the default unit for creator income; shows Mezo as platform for recurring payments.

---

## Track 3: Daily Bitcoin Applications

**Focus:** Bitcoin finance in normal workflows — invoices, bounties, savings, everyday cashflow.

### 1st Place: Invoiced
- **Repo:** github.com/Invoiced-Mezo-Hackathon/invoiced-dashboard
- **Leads:** Janice Gathoga, Tevin Isaac
- **What:** Freelancer invoice tool. Create invoice in USD → display BTC equivalent + QR → client pays BTC → BTC goes into Mezo vault as collateral → vault mints MUSD at 1% rate → freelancer spends MUSD. Boar Network WebSocket for live status. When ready, freelancer repays and unlocks BTC.
- **Why it won:** Turns "hold or spend" dilemma into a workflow for remote workers globally. Tightly integrates vaults, MUSD minting, Boar infra.

### 2nd Place: BountyPay
- **Repo:** github.com/lucci-xyz/bounty
- **Lead:** LucciLabs
- **What:** GitHub Issues → automatic MUSD payouts. Maintainer installs GitHub App → attaches bounty (MUSD in escrow on Mezo) to issue → contributor opens PR referencing issue → PR merges → contract releases MUSD to contributor. On-chain receipts.
- **Why it won:** Uses MUSD as payout currency for open-source work; trust-minimized bridge between GitHub events and Mezo transactions.

### Community Choice: MezoLotto
- **Repo:** github.com/AllenAJ/MezoLotto
- **Lead:** Aditya Bhansali + allenjosephaj
- **What:** No-loss lottery savings. Users deposit MUSD → pooled capital earns yield → yield = prize pool → winner selected from depositors → non-winners keep principal. Contracts deployed on Mezo testnet; adapters for randomness.
- **Why it won:** Makes saving engaging (Prize-linked savings); intuitive for non-crypto users.

---

## Key Patterns from 2025 Winners (for 2026 Planning)

1. **Infrastructure projects win DeFi tracks** — keeper automation, liquidation tooling, structured products
2. **Geographic focus wins Financial Access** — LATAM, Africa, Southeast Asia
3. **Developer workflow integrations win Daily Applications** — GitHub, invoicing, bounties
4. **MUSD is central** — every winner treats MUSD as the unit of account / settlement currency
5. **Mezo Passport was integrated** in almost all winning projects (it was required in 2025)
6. **Pyth oracle used** for price feeds in at least one project
7. **Boar Network's WebSocket RPC** was used for real-time updates
8. **ERC-1155 tokens** used for access/membership features

---

## What's Already Built (Do Not Rebuild These in 2026)

- Keeper automation for MUSD liquidations (TrovePilot)
- Option-style protection for unhealthy positions (BTCShield)
- Self-repaying loans via LP yield (StratumFi / Alchemix clone)
- Bitcoin-backed savings cooperatives (KhipuVault)
- NFC tap-to-pay MUSD cards (BitSpend)
- Creator payment toolkit with MUSD (CreatorBank)
- Bitcoin invoicing → MUSD minting (Invoiced)
- GitHub bounties → MUSD payouts (BountyPay)
- No-loss lottery savings (MezoLotto / Prize-linked savings)
