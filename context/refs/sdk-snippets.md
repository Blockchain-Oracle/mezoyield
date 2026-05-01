# SDK Code Snippets — Mezo

## 1. Mezo Passport (Wallet Connection)

### Installation
```bash
npm install @mezo-org/passport @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### Basic Setup (React/TypeScript)
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { getConfig, mezoTestnet } from "@mezo-org/passport";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={getConfig({ appName: "Your Mezo dApp" })}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={mezoTestnet}>
          {/* Your App component */}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
```

### Wallet Support
From latest version (0.17.2 config.ts):
- Mainnet: Unisat (mainnet), Xverse (mainnet), MetaMask and other EVM wallets
- Testnet: Unisat (testnet), Xverse (testnet), MetaMask and other EVM wallets

---

## 2. Hardhat Config (Testnet)

```javascript
module.exports = {
  defaultNetwork: "mezotestnet",
  networks: {
    mezotestnet: {
      url: "https://rpc.test.mezo.org",
      chainId: 31611,
      accounts: [process.env.PRIVATE_KEY]
    },
    mezomainnet: {
      url: "https://rpc-http.mezo.boar.network",  // or other provider
      chainId: 31612,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "london",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
};
```

---

## 3. MUSD Contract Interaction Pattern

From winners and docs — MUSD CDP pattern:
```solidity
// MUSD contract interactions (pseudocode based on Liquity-style CDP)
// Full contracts at: github.com/mezo-org/musd

// Open a trove (deposit BTC collateral, borrow MUSD)
borrowerOperations.openTrove(
    _maxFeePercentage,  // max fee willing to pay
    _MUSDAmount,        // MUSD to borrow
    _upperHint,         // for sorted troves list
    _lowerHint,
    { value: _collateralAmount }  // BTC collateral
);

// Deposit MUSD to Stability Pool
stabilityPool.provideToSP(_amount, _frontEndTag);

// Withdraw from Stability Pool
stabilityPool.withdrawFromSP(_amount);
```

---

## 4. Add Mezo to MetaMask (Testnet)
```javascript
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x7B9B',  // 31611 in hex
    chainName: 'Mezo Testnet',
    nativeCurrency: {
      name: 'BTC',
      symbol: 'BTC',
      decimals: 18
    },
    rpcUrls: ['https://rpc.test.mezo.org'],
    blockExplorerUrls: ['https://explorer.test.mezo.org']
  }]
});
```

---

## 5. Goldsky Subgraph (Indexing)

Goldsky is a technical sponsor — provides subgraph/indexing support for Mezo.
```
# Deploy a subgraph on Mezo via Goldsky
goldsky subgraph deploy mezo-musd-v1/1.0.0 --path ./subgraph.yaml
```

---

## 6. Tenderly (Debugging/Simulation)

Tenderly is a technical sponsor. Key capabilities:
- Fork Mezo testnet/mainnet for testing
- Simulate transactions before submitting
- Debug failed transactions with stack traces

```bash
# Add Mezo network to Tenderly (if supported)
# Check Tenderly dashboard for Mezo chain support
```

---

## 7. MUSD Faucet / Test Tokens

- Testnet BTC faucet: https://faucet.test.mezo.org
- Need Mezo testnet in wallet first (Chain ID 31611)
- Faucet is CAPTCHA-protected

---

## 8. Key Contract Addresses

[UNVERIFIED — need to check from mezo-org/musd repo or mezo.org/docs for actual deployed contract addresses on testnet and mainnet. The MUSD contract is referenced at explorer.test.mezo.org.]

From MUSD docs blog: testnet contract referenced at `0x637e22A1EBbca50EA2d34027c238317fD10003eB` (may be outdated/testnet only)
