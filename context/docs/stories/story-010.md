# STORY-010 — Submission shell — README, Vercel deploy, testnet addresses

**Epic:** EPIC-5: Polish  
**Priority:** P0  
**Depends on:** STORY-009 (all prior stories must be merged)  
**Estimated effort:** 1h

---

## User story

As the hackathon judges,  
I want a live Vercel demo URL, a clear README explaining how to use MezoYield,  
And a documented testnet contract address,  
So that I can quickly evaluate the project without needing to build or deploy myself.

---

## File modification map

```
mezoyield/
├── README.md                       (project overview, features, testnet address, demo URL)
├── LICENSE                         (MIT)
├── TESTNET_ADDRESSES.md            (chain, contract address, deployment tx)
└── screenshots/
    ├── dashboard.png              (annotated screenshot of dashboard)
    └── optimize.png               (annotated screenshot of optimize flow)
```

---

## Acceptance criteria

```gherkin
Given the README is written
Then it includes:
  - One-sentence project description
  - Problem & solution statement
  - Features list (auto-vote, manual, claim, history)
  - Link to live Vercel demo
  - Instructions: "pnpm install && pnpm dev"
  - Testnet contract address and explorer link
  - License (MIT)

Given the project is deployed to Vercel
When a judge visits the demo URL
Then the app loads, connects to Mezo Testnet, and the Dashboard is visible

Given TESTNET_ADDRESSES.md exists
Then it documents:
  - MezoYieldOptimizer address
  - Deployment transaction hash
  - Chain ID (31611)
  - RPC endpoint used
  - Date deployed

Given screenshots are captured
Then they show:
  - Dashboard with gauges, position, countdown
  - Optimize modal with sliders or auto strategy selected
  - Charts rendering with sample data
```

**Shell verification:**
```bash
# Verify build succeeds one final time
pnpm --filter @mezoyield/contracts build
pnpm --filter @mezoyield/app build

# Verify README and addresses file exist
test -f README.md && test -f TESTNET_ADDRESSES.md && echo "✓ submission ready"
```

---

## Constraints

- README must be concise (under 500 words for clarity)
- Live Vercel URL must be included — deploy before closing this story
- Screenshots must be annotated (callouts or arrows) to highlight key features
- TESTNET_ADDRESSES.md should be easily copy-pasteable (JSON or plain text)
- License file must be MIT (copy from `packages/app/LICENSE` or create new)
- Do not hardcode any secrets in the files — all sensitive keys stay in `.env`
