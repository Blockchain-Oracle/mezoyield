import { getConfig, mezoTestnet } from "@mezo-org/passport";

// Sentinel placeholder used in dev/test only. RainbowKit refuses to build
// the WalletConnect connector when the projectId is falsy, so we need a
// non-empty value at config time even when no real ID is available locally.
// WalletConnect handshakes only happen at user-click time, so this string is
// fine for builds and tests — it just means WC-dependent mobile wallets
// won't actually connect during local dev.
const DEV_WC_PLACEHOLDER = "mezoyield-dev-placeholder";

const envProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!envProjectId) {
  // Fail fast in production so a bad deploy doesn't silently ship a half-broken
  // connect flow for WalletConnect-dependent wallets (Trust, Rainbow mobile,
  // etc.). In dev/test we keep going so injected wallets (MetaMask, Xverse,
  // Unisat) still work end-to-end without an env var ceremony.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required in production. " +
        "Get a free project ID at https://cloud.walletconnect.com and set " +
        "it in your environment before deploying.",
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    "[mezoyield] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. " +
      "Using dev placeholder. WalletConnect-based mobile wallets will not " +
      "connect; injected wallets (MetaMask, Xverse, Unisat) still work. " +
      "Get a free ID at https://cloud.walletconnect.com.",
  );
}

const walletConnectProjectId = envProjectId ?? DEV_WC_PLACEHOLDER;

export const wagmiConfig = getConfig({
  appName: "MezoYield",
  appDescription:
    "Set-and-forget MEZO yield — auto-vote your veMEZO every epoch, claim in MUSD.",
  mezoNetwork: "testnet",
  walletConnectProjectId,
});

export { mezoTestnet };
