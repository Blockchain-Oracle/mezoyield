import { getConfig, mezoTestnet } from "@mezo-org/passport";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "mezoyield-dev";

export const wagmiConfig = getConfig({
  appName: "MezoYield",
  appDescription:
    "Set-and-forget MEZO yield — auto-vote your veMEZO every epoch, claim in MUSD.",
  mezoNetwork: "testnet",
  walletConnectProjectId,
});

export { mezoTestnet };
