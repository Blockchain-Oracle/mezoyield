import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    mezoTestnet: {
      url: process.env.MEZO_TESTNET_RPC ?? "https://rpc.test.mezo.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 31611,
    },
  },
};

export default config;
