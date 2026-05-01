# Transcript Signal Extraction — Mezo Hack 2026
**Extracted:** 2026-04-30  
**Source:** 7 workshop recordings (Encode Club)

---

## Summary: Judge Directives Spoken Out Loud

These are explicit statements from Mezo team members / organizers during workshops. Treat them as direct judging signals.

---

## Signal 1 — "MUSD is the hero of Mezo" (HIGH)
**Source:** Ryan Fox (community dev), Transcript 4 (X42 agentic payments workshop)  
**Quote:** *"the hero of Mezo, the MUSD. What you need to be doing is moving this token around the Mezo ecosystem."*  
**Implication:** Every submission should visibly move MUSD — not just hold it. On-chain transaction flows with MUSD are the bar.

---

## Signal 2 — "Find the rough edges of the economic system and simplify" (HIGHEST)
**Source:** Dimmitri Paremski (integration engineer), Transcript 3 (Mezo Earn workshop)  
**Quote:** *"you need to find the rough edges and where you can simplify certain things like for example free layer case — users don't need to remember about voting every single week. If you don't vote, you don't receive rewards."*  
**Implication:** Auto-voter / yield optimizer for the veBTC/veMEZO system is the explicitly named gap. He even demoed Bore Finance as the closest existing thing — and called it insufficient for casual users.

---

## Signal 3 — "We currently don't have a simple way of getting yield on MEZO token" (HIGHEST)
**Source:** Andre Coutinho (Supernormal Foundation lead), Transcript 7 (kickoff)  
**Quote:** *"we currently don't have anything that is like simple way of getting yield on mezo token today... to get yield on mezo token you need to participate on the system and you know you could either automate voting but you could just have like puron yield solutions on mezo"*  
**Implication:** A pure-yield product for the MEZO token is a gap explicitly named by a judge-adjacent person (Andre leads the foundation that sets judging direction). "Stake and forget" yield on MEZO is the whitespace.

---

## Signal 4 — "Build for aunt Linda, not crypto natives" (HIGH)
**Source:** Doug (community lead), Transcript 5 (Discord community workshop)  
**Quote:** *"build for the users in the general channel... your aunt Linda... think clean, general channel... we're all technically here to see crypto work for our mums"*  
**Implication:** UX simplicity is explicitly weighted. Complex DeFi power-user UIs will lose to clean, general-audience UIs. "Slap a nice UI on something complex" (Andre, T7) = real advice.

---

## Signal 5 — "Agentic payments are the future, X42 is how" (HIGH)
**Source:** Ryan Fox, Transcript 4  
**Quote:** *"When we think about the future of Agentic Payments, X42 is really the way... we can hand an agent a wallet and have them do this autonomously"*  
**Implication:** X42 (HTTP 402 payment flow for MUSD micropayments) is a sponsor-backed primitive. Building with it scores bonus points on MUSD integration AND differentiation. Gasless for end users — facilitator handles gas.

---

## Signal 6 — "Don't build a website with no teeth" (HIGH)
**Source:** Andre Coutinho, Transcript 7  
**Quote:** *"common pattern is you just built a oneshot clawed website build that has actually no real teeth or anything behind. It's just like a website or a deck. Don't do that."*  
**Implication:** Real smart contract interactions required. UI-only or "demo" submissions without on-chain flow won't place.

---

## Signal 7 — "Judges are kept distant from teams to avoid bias" (MODERATE)
**Source:** Andre Coutinho, Transcript 7  
**Quote:** *"we keep the people that are going to be on the judging panel a little bit further away from teams so that we aren't swayed or biased... we keep Rod and some other folks off the judging panel so that they are 100% available to you all"*  
**Implication:** Rod and the DevRel team are NOT judges. Talk to them freely — no pitch anxiety. The actual judges are separate (unknown identities per CONTEXT.md open questions).

---

## Signal 8 — "Post-hackathon path exists for good projects" (MODERATE)
**Source:** Andre Coutinho, Transcript 7  
**Quote:** *"incentives exist for projects post hackathon... we have a full path: accelerator, grants from the foundation... the supernormal foundation can be there for you along all the pathway"*  
**Implication:** Projects with real-world viability beyond the hackathon get preferred. Business viability (20% of judging) is not just a checkbox — they actually fund the winners.

---

## Signal 9 — "Options protocols are cool but hard to scale" (LOW)
**Source:** Andre Coutinho, Transcript 7  
**Quote:** *"options are super cool... hard sometimes to make them scale"*  
**Implication:** Options-based projects are interesting but carry execution risk skepticism from the judges.

---

## Signal 10 — Bore Finance named as existing auto-voter but insufficient (MODERATE)
**Source:** Andre Coutinho (T7) and Dimmitri (T3) both mentioned it  
**Quote (Andre):** *"Bore Finance... you deposit your VBTC NFT and they will generate yield with voting strategies based on that NFT"*  
**Implication:** Bore Finance exists and is known. A submission must go beyond Bore Finance — either better UX, broader scope (MUSD + MEZO, not just VBTC), or additional primitives (compounding, analytics).

---

## Summary Table

| Signal | Source | Strength | Implication for build |
|--------|--------|----------|----------------------|
| "MUSD is the hero" | Ryan Fox (T4) | 🔴 High | Visibly move MUSD on-chain |
| "Find rough edges, auto-voter" | Dimmitri (T3) | 🔴 Highest | Auto-voter/yield optimizer = named gap |
| "No simple MEZO yield" | Andre (T7) | 🔴 Highest | Stake-and-forget MEZO yield = whitespace |
| "Build for aunt Linda" | Doug (T5) | 🔴 High | Clean UX, general audience |
| "X42 = agentic future" | Ryan Fox (T4) | 🟡 High | Integrate X42 for MUSD flows |
| "No teeth submissions" | Andre (T7) | 🔴 High | Real smart contract calls required |
| "Judges distant from teams" | Andre (T7) | 🟡 Moderate | Rod/DevRel = free help, not judges |
| "Post-hackathon path" | Andre (T7) | 🟡 Moderate | Show real business viability |
| "Options cool but hard" | Andre (T7) | 🟢 Low | Options = risky direction |
| "Bore Finance exists" | Andre (T7) + Dimmitri (T3) | 🟡 Moderate | Must go beyond Bore Finance |

---

## Track Recommendation (Derived from Signals)

**MEZO Track** — strongest signal alignment:
- Andre explicitly named "simple MEZO yield" as missing (Signal 3)
- Dimmitri explicitly named "auto-voter" as the rough edge to solve (Signal 2)
- Both signals point to the same product: automated yield management for the veMEZO/veBTC system
- No prior winner in this track (MEZO token launched Jan 2026, this is the first MEZO track hackathon)
- Bore Finance exists but covers only VBTC delegation — not full system

**Winning product direction: "MezoYield" — automated yield optimizer**
- Users deposit VBTC NFT and/or veMEZO → vault auto-votes every epoch for max yield
- Handles claiming, compounding back into the pool
- MUSD integration: yield denominated/displayable in MUSD; optional X42 fee layer
- Mezo Passport for wallet connection (mandatory)
- UX: 3-screen flow (connect → deposit → dashboard showing weekly BTC yield)
