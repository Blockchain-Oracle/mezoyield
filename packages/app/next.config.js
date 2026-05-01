/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Several @mezo-org packages ship raw TypeScript through their package main
  // (orangekit-contracts ships index.ts, orangekit-smart-account ships .ts under
  // src/). Let Next.js transpile them with the rest of the app.
  transpilePackages: [
    "@mezo-org/passport",
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-contracts",
    "@mezo-org/orangekit-smart-account",
    "@mezo-org/mezo-clay",
    "@mezo-org/sign-in-with-wallet",
  ],
  webpack: (config) => {
    // wagmi / WalletConnect pull node-only modules in some code paths.
    // Stub them so the browser bundle compiles cleanly.
    config.externals = [...(config.externals ?? []), "pino-pretty", "encoding"];
    return config;
  },
};

module.exports = nextConfig;
