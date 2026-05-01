# STORY-004 — Deploy to Mezo Testnet + address config

**Epic:** EPIC-2: Core contract  
**Priority:** P0  
**Depends on:** STORY-003  
**Estimated effort:** 1h

---

## User story

As a developer,  
I want `MezoYieldOptimizer` deployed to Mezo Testnet (Chain ID 31611) with its address committed to the repo,  
So that the frontend can import and use the live contract address.

---

## File modification map

```
packages/contracts/
├── scripts/
│   └── deploy.ts                   (full deploy script targeting Mezo Testnet)
├── deployments/
│   └── mezo-testnet.json           (written by deploy script: {address, txHash, blockNumber})
packages/app/
└── lib/
    └── contracts.ts                (exports OPTIMIZER_ADDRESS from mezo-testnet.json)
```

---

## Acceptance criteria

```gherkin
Given PRIVATE_KEY and MEZO_RPC_URL are set in .env
When I run `pnpm --filter @mezoyield/contracts deploy:testnet`
Then the contract is deployed to Mezo Testnet (Chain ID 31611)
And `deployments/mezo-testnet.json` is written with address, txHash, blockNumber
And the address is verified on https://explorer.test.mezo.org

Given the deployment JSON exists
When I build the app package
Then `lib/contracts.ts` exports the correct OPTIMIZER_ADDRESS without TypeScript errors
```

**Shell verification:**
```bash
cat packages/contracts/deployments/mezo-testnet.json   # must exist and contain address
pnpm --filter @mezoyield/app build                      # must exit 0
```

---

## Constraints

- Deploy script must read `PRIVATE_KEY` from `.env` (never hardcode)
- Use Mezo Testnet: Chain ID 31611, RPC `https://rpc.test.mezo.org`
- The deployment JSON must be committed (it's not a secret — it's the contract address)
- `.env` must be in `.gitignore` — never commit private keys
- If testnet faucet is needed: `solana airdrop` equivalent is at `https://faucet.test.mezo.org`
- Do not use tBTC from the faucet for anything other than gas
