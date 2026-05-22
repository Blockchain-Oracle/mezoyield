import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Mezo Mainnet fork support for end-to-end integration testing. Activate
// by setting `MEZO_MAINNET_FORK=1` and running scripts/tests against the
// `hardhat` network. The fork lets us deploy v3 contracts alongside the
// real Mezo BoostVoter/veMEZO and impersonate real NFT holders, so the
// new per-user vote fan-out is proven against actual on-chain ABIs
// before any mainnet write.
const HARDHAT_NETWORK_CONFIG = process.env.MEZO_MAINNET_FORK === "1"
  ? {
      chainId: 31612,
      forking: {
        url: process.env.MAINNET_RPC_URL ?? "https://rpc-http.mezo.boar.network",
      },
    }
  : {};

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: HARDHAT_NETWORK_CONFIG,
    mezoTestnet: {
      url: process.env.MEZO_TESTNET_RPC ?? "https://rpc.test.mezo.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 31611,
    },
    // Boar Network is the production-grade mainnet RPC (sponsor-provided,
    // full eth_call support). `mezo.drpc.org` is community/free but
    // chainId-only — fine as a fallback for keeper chainId probes, not
    // for deploys. Codex P3 (pre-push): adds the `mezoMainnet` network
    // so `deploy:mainnet` resolves to a real command and the
    // contracts.ts fail-fast message can point at it. Prefer
    // MAINNET_DEPLOYER_PRIVATE_KEY when set; fall back to
    // DEPLOYER_PRIVATE_KEY so reusing the same EOA across networks
    // (the demo path) doesn't need a second .env entry.
    mezoMainnet: {
      url: process.env.MAINNET_RPC_URL ?? "https://rpc-http.mezo.boar.network",
      accounts: process.env.MAINNET_DEPLOYER_PRIVATE_KEY
        ? [process.env.MAINNET_DEPLOYER_PRIVATE_KEY]
        : process.env.DEPLOYER_PRIVATE_KEY
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
      chainId: 31612,
    },
  },
};

export default config;
