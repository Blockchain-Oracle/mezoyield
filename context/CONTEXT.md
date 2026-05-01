# CONTEXT.md — Mezo Hack: Building Bitcoin's Future
# Master Entrypoint for Downstream Agents

**Research completed:** 2026-04-30  
**Hackathon status:** LIVE (April 13 – May 25, 2026)  
**Researcher:** Sahil research agent  

---

## 1. What This Hackathon Is

Mezo Hack: Building Bitcoin's Future is the second Mezo hackathon, hosted by Encode Club in partnership with the Supernormal Foundation. It's a 6-week online builder program (April 13 – May 25, 2026) for developers who want to build on Mezo — a Bitcoin-native EVM-compatible sidechain that lets BTC holders borrow MUSD (a 100% Bitcoin-backed stablecoin) at fixed 1–5% APR, lock BTC for ve-tokenomics yield, and build consumer/DeFi applications using BTC as the base money.

The 2026 edition introduces the MEZO token (launched Jan 26, 2026) as both the prize currency and a required integration target. Every submission must integrate MUSD and MEZO, deploy a working demo on Mezo testnet, and pass KYB verification for prize distribution. Prize pool: $30,000 in veMEZO prizes plus $30,000 in milestone grants = $60,000 total across 3 tracks.

---

## 2. Available Tracks + Abu's Recommended Target Track

### Track Summary

| Track | Prize per winner | Focus |
|-------|-----------------|-------|
| Bitcoin Track | $5K veMEZO + $5K grant | BTC-native yield, lending, payments, treasury |
| MUSD Track | $5K veMEZO + $5K grant | Consumer apps using Bitcoin-backed MUSD |
| MEZO Track | $5K veMEZO + $5K grant | MEZO staking, governance, liquidity, infra |

### Recommended Target Track: MEZO Track

**Why:** The MEZO Track is the newest (no equivalent in 2025 hackathon) and has the least competition from prior winners. The matching market (veBTC gauge voting, veMEZO boosting) went live in January 2026 and there is zero dedicated tooling for gauge optimization, analytics, or governance automation. The judging signal from Mezo's 2026 roadmap (cross-chain MUSD, new yield strategies, institutional tooling) aligns perfectly with MEZO Track projects that make the ve-system more powerful. A "Votium/Convex for Mezo" gauge optimizer would win this track decisively.

**Alternative strong targets:**
- **Bitcoin Track**: A MUSD yield aggregator (auto-routing MUSD across Stability Pool, Savings Rate gauge, and LP pools) — analogous to Yearn on Ethereum. Nothing like this exists on Mezo.
- **MUSD Track**: Remittance with MUSD (LATAM corridor specific, off-ramp integration). KhipuVault won savings in 2025; remittances are the adjacent lane.

> [WEDGE CALL IS ABU'S — this section names open fields, not directs. Abu decides the wedge after reading this research.]

---

## 3. Key Verified Facts

| Fact | Value | Source | Verified? |
|------|-------|--------|-----------|
| Submission deadline | May 25, 2026 | web3voyager.com, mezo.org blog | YES |
| Start date | April 13, 2026 | Encode Club, Mezo blog | YES |
| Duration | 6 weeks | All sources | YES |
| Prize (1st place per track) | $5,000 in veMEZO + $5,000 milestone grant | Mezo blog Apr 2026 | YES |
| Total prize pool | $30K prizes + $30K grants = $60K veMEZO | Mezo blog | YES |
| Tracks | 3 (Bitcoin, MUSD, MEZO) | Mezo blog | YES |
| Chain ID testnet | 31611 | mezo.org/docs/developers/getting-started | YES |
| Chain ID mainnet | 31612 | mezo.org/docs/developers/getting-started | YES |
| Testnet RPC | https://rpc.test.mezo.org | mezo.org/docs | YES |
| Faucet | https://faucet.test.mezo.org | mezo.org/docs | YES |
| Judging criteria | 30% integration / 30% technical / 20% business / 10% UX / 10% presentation | Oct 2025 blog (expected same for 2026) | PARTIALLY VERIFIED |
| KYB required for winners | Yes | Mezo blog | YES |
| MUSD borrow rate | Fixed 1–5% APR | mezo.org/blog/musd-fixes-bitcoin | YES |
| MUSD min collateralization | 110% | mezo.org/blog/musd-fixes-bitcoin | YES |
| veBTC max lock | 30 days | mezo.org/blog/introducing-mezo | YES |
| MEZO supply | 1,000,000,000 | mezo.org/blog/introducing-mezo | YES |
| MEZO TGE | January 26, 2026 | mezo.org/blog/introducing-mezo tokenomics | YES |
| Mainnet live | Yes | mezo.org blog, Bullish Exchange listing Apr 2026 | YES |

---

## 4. What Exists in the Field (Incumbents)

### Already Built by Prior Winners (Do Not Duplicate)
- **TrovePilot** — permissionless keeper automation for MUSD liquidations/redemptions
- **BTCShield** — option-style protection for unhealthy loan positions
- **StratumFi** — self-repaying loans (Alchemix pattern) via MUSD/BTC LP yield
- **KhipuVault** — Bitcoin-backed cooperative savings for LATAM
- **BitSpend** — self-custodial NFC tap-to-pay cards for MUSD
- **CreatorBank** — creator payment toolkit (tips, subscriptions, invoices) in MUSD
- **Invoiced** — freelancer BTC invoicing that auto-mints spendable MUSD
- **BountyPay** — GitHub Issues → automatic MUSD bounty payouts
- **MezoLotto** — no-loss lottery savings in MUSD

### Competitive Protocol Landscape
- Mezo vs Liquity: similar CDP mechanics but Mezo uses BTC (not ETH); ve-tokenomics added
- Mezo vs Rootstock: both EVM + BTC sidechains; Mezo is more DeFi-native, newer
- Mezo vs Stacks: different model; Stacks is L2, Mezo is sidechain
- BTC payments: Lightning Network (fast P2P) vs MUSD (stablecoin, spendable)
- Competing stablecoins: USDT/USDC (fiat-backed), USDe (Ethena), crvUSD — MUSD is the only 100% BTC-backed

---

## 5. Available Primitives (What's Live)

### Infrastructure
| Resource | Value |
|----------|-------|
| Testnet RPC (HTTPS) | https://rpc.test.mezo.org |
| Testnet RPC (WSS) | wss://rpc-ws.test.mezo.org |
| Testnet Chain ID | 31611 |
| Mainnet Chain ID | 31612 |
| Mainnet RPCs | Boar, Imperator, Validation Cloud, dRPC (see 02-sponsor-docs.md) |
| Block explorer (testnet) | https://explorer.test.mezo.org |
| Block explorer (mainnet) | https://explorer.mezo.org |
| Faucet | https://faucet.test.mezo.org |
| EVM toolchain | Hardhat, Foundry (fully compatible) |
| Solidity version | 0.8.28 (evmVersion: london) |

### SDKs and Packages
| Package | Purpose | Install |
|---------|---------|---------|
| @mezo-org/passport | Wallet connection (Bitcoin + EVM wallets via RainbowKit) | `npm install @mezo-org/passport @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query` |
| wagmi + viem | EVM interactions | Bundled with passport |
| @mezo-org/musd contracts | MUSD CDP smart contracts | `git clone github.com/mezo-org/musd` |
| Goldsky | Subgraph indexing for Mezo chain data | Sponsor - check goldsky.com |
| Tenderly | Transaction simulation/debugging | Sponsor - check tenderly.co |

### Smart Contract Primitives
1. MUSD minting/borrowing (CDP, 110% min CR, 1% fixed rate)
2. Stability Pool (deposit MUSD, earn BTC from liquidations)
3. veBTC gauges (vote on fee/emission distribution)
4. MUSD Savings Rate (stake MUSD for BTC fees + MEZO emissions)
5. LP pools — Tigris DEX (BTC/MUSD pairs)
6. tBTC bridge (trust-minimized BTC → EVM BTC)
7. Pyth oracle (price feeds)
8. Boar Network WebSocket RPC (real-time chain events)

---

## 6. Open Questions (Not Confirmed)

1. **Judging criteria weights for 2026** — confirmed for 2025 (30/30/20/10/10); assumed same for 2026 but not explicitly stated in 2026 blog post
2. **@mezo-org/passport required or optional in 2026?** — 2025: explicitly required; 2026 developer docs say "optional"; 2026 hackathon blog post doesn't specify. Safest: integrate it.
3. **Judge identities for 2026** — No panel announced publicly. Known workshop hosts: Dymitr Paremski, Andre Coutinho, Ryan Watts, Rodrigo Carraresi (Supernormal)
4. **Team size limits** — Not found in any public source. Likely 1–4 per Encode Club norms.
5. **Submission platform URL** — encodeclub.com programme page but no separate submission portal URL found
6. **Exact MUSD contract addresses on mainnet/testnet** — Referenced in docs but not compiled in one place; check github.com/mezo-org/musd repo
7. **Whether Community Choice votes happen on Discord again** — Was the model in 2025; assumed same
8. **YouTube video titles for videos 2–7** — Video 1 confirmed as "Data Made Easy - Under the Hood with Goldsky"; others still [UNVERIFIED]
9. **Transcripts for all 7 videos** — Audio transcription jobs submitted but not yet complete at time of research writing (check /tmp/mezo-transcript-N.txt files)
10. **"Enigma" sponsor role** — Listed as technical partner but role unclear
11. **Sats Ventures sponsor role** — Listed as sponsor but details unknown
12. **Whether Mezo Passport integration earns judging credit in 2026** — Ambiguous given docs say it's "optional"

---

## 7. File Index

```
research/mezo-2026/
  CONTEXT.md                 ← This file (master entrypoint)
  00-overview.md             ← One-page hackathon summary
  01-prizes-tracks.md        ← Full prize breakdown, track specs, judging criteria, schedule
  02-sponsor-docs.md         ← Mezo primitives, SDKs, network details, GitHub repos
  03-project-gallery.md      ← Current submissions (none public yet; hackathon still live)
  04-competitor-analysis.md  ← Adjacent protocols, what exists, what patterns win
  05-prior-winners.md        ← All 9 winners from Oct–Nov 2025 hackathon (detailed)
  06-hidden-field.md         ← Lane saturation per track; open whitespace
  07-pre-commit-checklist.md ← Playbook §7 answers (scam check, requirements, judging bias)
  transcripts/
    video-1.txt              ← "Data Made Easy: Under the Hood with Goldsky" [PENDING transcript]
    video-2.txt through video-7.txt ← [PENDING transcripts — audio jobs running]
  refs/
    sdk-snippets.md          ← Key code snippets (Passport setup, Hardhat config, MUSD patterns)
    sponsor-repos.md         ← All mezo-org repos with clone commands + 2025 winner repos
```

---

## 8. Cold-Start Instruction for Downstream Agents

You are a coding/spec agent building a project for the Mezo Hack: Building Bitcoin's Future hackathon (Encode Club, April 13 – May 25, 2026).

**Chain:** Mezo (EVM-compatible sidechain, Chain ID testnet: 31611, mainnet: 31612). BTC is the gas token. EVM toolchain (Hardhat/Foundry/wagmi/viem) works out of the box.

**Mandatory integrations:**
1. MUSD — the Bitcoin-backed stablecoin (borrow against BTC at fixed 1% rate). Contracts at github.com/mezo-org/musd.
2. MEZO token — the coordination/multiplier asset (lock for veMEZO to boost BTC yield up to 5x). Must be meaningfully integrated, not just mentioned.

**Wallet connection:** Use @mezo-org/passport (npm) — RainbowKit wrapper that supports Bitcoin wallets (Xverse, Unisat) + EVM wallets.

**Testnet setup:**
- RPC: https://rpc.test.mezo.org
- Chain ID: 31611
- Explorer: https://explorer.test.mezo.org
- Faucet: https://faucet.test.mezo.org

**Key contracts to know:** BorrowerOperations, StabilityPool, TroveManager, MUSD token (all in mezo-org/musd repo).

**Judging weights:** Mezo Integration 30%, Technical Implementation 30%, Business Viability 20%, UX 10%, Presentation 10%.

**Do NOT duplicate:** TrovePilot, BTCShield, StratumFi, KhipuVault, BitSpend, CreatorBank, Invoiced, BountyPay, MezoLotto (all built in Oct–Nov 2025 hackathon — see 05-prior-winners.md for full details).

**Open whitespace (highest priority):** veBTC gauge optimizer (Votium for Mezo), MUSD yield aggregator, cross-chain MUSD bridge, remittance app, governance analytics dashboard.

**Read next:** 06-hidden-field.md for full saturation analysis, then 02-sponsor-docs.md for full technical primitives.
