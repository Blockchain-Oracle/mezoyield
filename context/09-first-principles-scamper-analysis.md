# First-Principles + SCAMPER Analysis — Mezo Hack 2026

## Track 1: Bitcoin Track

### First-Principles Decomposition

**Problem statement**
BTC holders want yield, liquidity, and simple risk management without turning their stack into a weekly DeFi chore.

**Assumptions to challenge**
- Builders should ship more protocol machinery. But 2025 already covered keeper bots, self-repaying loans, and options.
- Judges want exotic finance. The transcripts point harder at simplicity, automation, and visible MUSD movement.
- The ecosystem needs more products. It mostly needs fewer rough edges.
- Complexity is a badge. On Mezo, it’s a penalty if users must manually vote every week.

**Fundamental truths**
- Borrowing against BTC and spending MUSD is live.
- Mezo Earn is live, but manual voting is the friction.
- Transcript 3 says users must not have to remember weekly voting.
- Bore Finance already exists, so “basic auto-voter” is not enough.
- 2025 already saturated keeper/liquidation, self-repaying loan, and options plays.
- MUSD and Passport are mandatory, so the build must visibly move MUSD and connect wallets cleanly.

**Rebuilt solution space**
The simplest high-signal build is a BTC yield manager:
- connect wallet via Passport
- deposit veBTC / BTC position
- auto-select gauges each epoch
- claim rewards
- show yield in MUSD terms
- optionally compound into MUSD savings or a BTC vault

### Full SCAMPER

**S — Substitute**
- Substitute manual weekly voting with algorithmic vote allocation.
- Why: removes the exact pain point named in the workshops.

**C — Combine**
- Combine veBTC voting with MUSD savings compounding.
- Why: turns yield into a full loop instead of a single action.

**A — Adapt**
- Adapt Convex-style boost optimization to Mezo.
- Why: users understand “set and forget yield” instantly.

**M — Modify**
- Modify cadence from “vote weekly” to “auto-manage continuously.”
- Why: simplest way to make the product feel obvious.

**P — Put to other uses**
- Use voting data as a BTC yield intelligence feed.
- Why: analytics becomes product, not just dashboard garnish.

**E — Eliminate**
- Eliminate the need to understand gauges at all.
- Why: judges explicitly praised simplification.

**R — Reverse**
- Reverse the model: yields hunt the user.
- Why: users choose risk bounds, the vault does the rest.

**Strongest angle**
**Modify**. The weekly-voting pain is explicit, the fix is clear, and the ship is feasible.

---

## Track 2: MUSD Track

### First-Principles Decomposition

**Problem statement**
MUSD is strong as a unit of account, but consumer adoption still needs a real everyday flow with low friction and clear utility.

**Assumptions to challenge**
- Invoicing is the obvious answer. That lane is taken.
- Tap-to-pay NFC is the obvious answer. That lane is taken too.
- Generic global consumer apps win. The 2025 winners say narrow markets win.
- Payments must mean “checkout UI.” The transcripts say agentic payments and moving MUSD around are the point.

**Fundamental truths**
- Transcript 4 says MUSD is the hero of Mezo and should be moved around the ecosystem.
- Transcript 7 says every project must use MUSD and Passport.
- Transcript 4 and 7 both push simple, human workflows.
- 2025 winners already covered invoices, creator tools, NFC cards, bounties, and lottery savings.
- Open whitespace remains in remittances, merchant checkout, SaaS billing, and mobile-first wallets.

**Rebuilt solution space**
The simplest high-signal build is a MUSD remittance / payment rail:
- sender mints or sources MUSD
- sends it through a clean flow
- recipient receives MUSD or local-currency off-ramp value
- Passport handles wallet connection
- MUSD remains the visible settlement unit

### Full SCAMPER

**S — Substitute**
- Substitute USDC/USDT with MUSD in a corridor flow.
- Why: keeps BTC backing and makes Mezo the settlement layer.

**C — Combine**
- Combine remittance with an off-ramp partner and a savings vault.
- Why: money arrives, then keeps working.

**A — Adapt**
- Adapt Wise’s UX, but on-chain.
- Why: the model is proven and easy to explain.

**M — Modify**
- Modify the audience from “crypto users” to one corridor or one niche.
- Why: narrow beats generic, and judges like real use cases.

**P — Put to other uses**
- Use MUSD as a payroll, creator, or treasury rail.
- Why: same product primitives, different surface area.

**E — Eliminate**
- Eliminate custodial complexity where possible.
- Why: self-custody + simple flow is the value.

**R — Reverse**
- Reverse the flow from “spend stablecoin” to “enter BTC savings ecosystem.”
- Why: makes the app more than a payment screen.

**Strongest angle**
**Adapt**. Copy the simplest remittance UX that already wins trust, then make MUSD the settlement asset.

---

## Track 3: MEZO Track

### First-Principles Decomposition

**Problem statement**
MEZO token utility is under-shaped. Users need a simple way to get yield, understand emissions, and act on the system without manual weekly effort.

**Assumptions to challenge**
- MEZO track is about staking UI only. That’s already table stakes.
- Governance is boring. The hidden field says it’s actually open.
- Users want to understand ve mechanics. They mostly want yield.
- A little automation is enough. The workshops said the rough edge is the weekly voting burden.

**Fundamental truths**
- Transcript 7: “we currently don’t have anything that is like simple way of getting yield on mezo token today.”
- Transcript 3: users shouldn’t need to remember voting every week.
- Transcript 7: all projects must use MUSD and Passport.
- 2025 had zero governance / MEZO tooling winners.
- Bore Finance exists, but only partly solves the problem.
- The MEZO track has the cleanest whitespace and the clearest judge-directed gap.

**Rebuilt solution space**
The simplest high-signal build is a MEZO yield OS:
- connect via Passport
- deposit / connect MEZO or ve position
- auto-vote gauges based on policy
- surface expected yield in MUSD terms
- show gauge APYs, emissions, and system health
- optionally let users override or set risk preferences

### Full SCAMPER

**S — Substitute**
- Substitute manual voting with policy-based automation.
- Why: directly attacks the stated pain.

**C — Combine**
- Combine voting, analytics, and MUSD-denominated rewards.
- Why: one product, three judge-relevant surfaces.

**A — Adapt**
- Adapt Snapshot-style governance UX, but make it yield-first.
- Why: familiar mental model, better outcome.

**M — Modify**
- Modify the product from governance tool to “set-and-forget yield.”
- Why: matches what the workshop explicitly asked for.

**P — Put to other uses**
- Use vote data as protocol intelligence.
- Why: gives the system a dashboard of record.

**E — Eliminate**
- Eliminate the need to understand emissions math.
- Why: simplifies the whole chain of reasoning.

**R — Reverse**
- Reverse the flow so the system recommends yields first and explanations second.
- Why: better UX for normal users.

**Strongest angle**
**Eliminate + Modify**. Remove the mental overhead, then automate the chore.

---

## Cross-Track Synthesis

### 1) Compare signal strength
**MEZO Track** is the clearest. Two separate workshop signals converge on the same gap: no simple MEZO yield path, and weekly voting is the rough edge.

### 2) Compare saturation
**MEZO Track** has the most whitespace. No 2025 winner occupied governance / MEZO tooling.

### 3) Compare prior winners
**MEZO Track** differentiates best. Bitcoin and MUSD tracks both have obvious 2025 incumbents to avoid. MEZO does not.

### 4) Compare MUSD / Passport fit
- **MEZO Track:** natural fit. MUSD becomes the reward display unit; Passport is the voting wallet.
- **MUSD Track:** also natural, especially in remittance.
- **Bitcoin Track:** least natural; MUSD can feel bolted on unless it is a savings or yield display layer.

### 5) Compare feasibility
- **MEZO Track:** very feasible in 6 weeks. Mostly contracts + voting logic + analytics.
- **MUSD Track:** feasible, but off-ramp partnerships add risk.
- **Bitcoin Track:** feasible, but hardest to differentiate from existing open-lane competitors.

### Final verdict
**Best track:** **MEZO Track** — strongest judge signal, lowest saturation, best differentiation.

**Best idea on that track:** **MEZO Yield OS / Votium for Mezo** — an auto-voter + governance analytics dashboard that makes MEZO yield simple, visible, and MUSD-denominated.

**Why it wins:**
- directly answers the workshop’s stated pain
- fits the mandatory MUSD + Passport rule naturally
- avoids the saturated 2025 winner lanes
- is buildable without inventing a new protocol
- gives judges a clean demo: connect → analyze → auto-vote → claim yield

**Secondary option:** **MUSD remittance rail** if the team wants a more consumer-facing wedge with slightly clearer business value, but higher external dependency risk.
