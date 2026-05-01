# Pre-Commit Checklist — Playbook §7 Answers

These are the required strategic questions from the hackathon playbook answered for Mezo 2026.

---

## §7.1 Is this hackathon real?

**YES.**
- Hosted by Encode Club (established Web3 accelerator with documented prior hackathons)
- Sponsored by Mezo (mainnet live, token listed on Bullish Exchange, $400M+ in ecosystem activity)
- Prior hackathon ran Oct–Nov 2025 with 9 publicly verified winners and GitHub repos
- Prize currency is veMEZO (real token, live on Bullish Exchange as of April 2026)
- Supernormal Foundation is the co-organizer (founded by Thesis*, backed by Arthur Hayes, Dan Held, Dovey Wan, Will Reeves)
- **Scam risk: VERY LOW**

---

## §7.2 Are prizes real and deliverable?

**YES, with caveats.**
- Prizes paid in **veMEZO** (vote-escrowed MEZO tokens) — not MUSD as in 2025
- MEZO token is live, tradeable on Bullish Exchange
- veMEZO specifically = locked MEZO tokens (not instantly liquid; they have a lock period)
- KYB verification required for all winners
- Prize is $5K + $5K milestone grant per 1st place (milestone grant has vesting conditions)
- **Real value:** Yes. **Instantly liquid:** No (veMEZO = locked tokens with unlock schedule)

---

## §7.3 Are the technical requirements buildable?

**YES.**
- EVM-compatible chain — standard Solidity/Hardhat/Foundry tooling
- Testnet available with public RPC and faucet
- MUSD contracts open source (github.com/mezo-org/musd)
- @mezo-org/passport SDK available via npm
- Multiple RPC providers (Boar, Validation Cloud, Imperator, dRPC)
- Tenderly is a technical partner — debugging/simulation tooling available
- Goldsky is a technical partner — subgraph/indexing tooling available
- Mainnet is live so reference implementations exist

---

## §7.4 Does a 6-week timeline make sense?

**YES.**
- 6 weeks is generous for a focused dApp (most hackathon projects ship in 2–3 weeks)
- Abu's build model uses agents — compression is possible
- Checkpoints at week 2 and week 4 require showing progress early
- Best strategy: spec weeks 1–2, build weeks 2–4, polish weeks 5–6

---

## §7.5 What's the judging bias?

**Mezo Integration > Technical Quality > Business Viability**

From the explicit 2025 criteria (expected similar for 2026):
- 30% Mezo Integration (MUSD + Passport usage)
- 30% Technical Implementation
- 20% Business Viability
- 10% UX
- 10% Presentation

**Judging bias observed from 2025 winners:**
- Projects that made MUSD the primary unit of account (not just a feature) won
- Infrastructure that directly improves protocol health won the DeFi track
- Geographic specificity (LATAM) won Financial Access
- Developer tools that integrate with existing workflows (GitHub) won Daily Applications

**2026 shift:** Prize currency changed to veMEZO — judges may favor projects that make veMEZO or the Mezo Earn mechanism more useful/accessible to users (the MEZO Track is new).

---

## §7.6 What's the realistic competition size?

**MEDIUM field.**
- Encode Club typically sees 50–200 teams register; 20–50 actually submit
- 2025 hackathon had exactly 9 winners across 3 tracks (3 per track) — submissions were curated, not massive
- Mezo is a Bitcoin-native chain — this limits to EVM builders with Bitcoin interest (smaller pool than Ethereum hackathons)
- Community Choice winners are selected by community delegates elected on Discord — relationship/visibility matters

---

## §7.7 Is there a community choice component?

**YES.**
- Community Choice is 1 of 3 prizes per track ($2K + $2K grant)
- Selected by "community delegates elected on Discord"
- Strategy: be visible in Mezo Discord, share progress updates, get community engagement
- 2025 community choices: StratumFi (DeFi), CreatorBank (Financial Access), MezoLotto (Daily)

---

## §7.8 What are the hard requirements?

**Must haves:**
1. Integrate MUSD
2. Integrate MEZO (token, not just the chain)
3. Working demo on Mezo testnet
4. Original work built during hackathon
5. KYB for prize distribution

**Note:** @mezo-org/passport was explicitly required in 2025. For 2026, docs say it's "optional" — but integrating it is still likely high-signal for judging (shows proper Bitcoin wallet support). Verify in official 2026 rules.

---

## §7.9 Submission platform?

**[UNVERIFIED]** — Encode Club runs their own programme system at encodeclub.com. No Devfolio or HackQuest link found. Submissions likely submitted through Encode Club's programme portal.

---

## §7.10 Judge composition?

**[PARTIALLY KNOWN]**
- Mezo core team (Dymitr Paremski mentioned in workshops)
- Supernormal Foundation (Rodrigo Carraresi)
- Encode Club team
- Technical sponsors (Boar, Validation Cloud, Spectrum mentioned in 2025)
- External: [UNVERIFIED for 2026]

---

## §7.11 Post-hackathon path?

**YES — strong signals.**
- "Winning teams receive distribution and visibility through Mezo's channels"
- 2025 winners invited to pitch at Devconnect (Buenos Aires)
- Supernormal Foundation provides mentorship, capital, go-to-market support
- The Foundation's mission is explicitly to "accelerate BitcoinFi innovation" — they want teams to continue building
- Milestone grants ($5K/$3K/$2K) are structured for post-hackathon continuation

---

## §7.12 Is this a recurring/scam pattern?

**NO.**
- This is the 2nd Mezo hackathon (not recurring in the "fake recurring" sense)
- First hackathon had verifiable winners with public GitHub repos
- Prize amounts decreased from 2025 ($37.5K MUSD) to 2026 ($30K veMEZO) — consistent with token vs. stablecoin prize structure change
- Encode Club has a clean reputation (also ran Kite AI hackathon, ETHLisbon, AI London)
