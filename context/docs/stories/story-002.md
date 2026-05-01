# STORY-002 — UI scaffold + Mezo Passport connect

**Epic:** EPIC-1: Foundation  
**Priority:** P0  
**Depends on:** STORY-001  
**Estimated effort:** 1.5h

---

## User story

As a user visiting MezoYield,  
I want to see the app header and connect my wallet via Mezo Passport,  
So that my veMEZO position can be read in subsequent stories.

---

## File modification map

```
packages/app/
├── app/
│   ├── layout.tsx              (add WagmiProvider + PassportProvider)
│   ├── providers.tsx           (wagmi + passport client config)
│   └── page.tsx                (two-mode layout shell: Dashboard | Optimize tabs)
├── components/
│   ├── Header.tsx              (app title, tab switcher, connect button)
│   └── ConnectButton.tsx       (Mezo Passport connect/disconnect)
├── lib/
│   ├── wagmi.ts                (wagmi config with Mezo Testnet chain)
│   └── passport.ts             (Mezo Passport config)
└── package.json                (add wagmi, viem, @mezo-org/passport)
```

---

## Acceptance criteria

```gherkin
Given the app is running on localhost
When I open the root URL
Then I see the MezoYield header with "Dashboard" and "Optimize" tabs

When I click the "Connect" button
Then Mezo Passport opens and I can connect a wallet

When my wallet is connected
Then the header shows my truncated address
And the "Connect" button changes to "Connected" or shows the address

When I click "Dashboard" tab
Then the dashboard panel is visible

When I click "Optimize" tab
Then the optimize panel is visible
```

**Shell verification:**
```bash
pnpm --filter @mezoyield/app build   # must exit 0
```

---

## Constraints

- Use `@mezo-org/passport` npm package for wallet connection (mandatory)
- Use wagmi v2 + viem v2 (no ethers.js)
- Mezo Testnet config: Chain ID 31611, RPC `https://rpc.test.mezo.org`
- Use shadcn/ui components (Button, Tabs) — do not invent custom components
- The tab switcher controls which panel renders — single route `/` only
- No real data in this story — panels can show placeholder text
- Follow the anchor product's color tokens from CLAUDE.md (set after UI mining)
