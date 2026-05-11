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
    // @metamask/sdk's browser bundle conditionally imports a React Native
    // AsyncStorage module that's not present in browser/Next contexts.
    // The import path resolves at module load time even though the branch
    // is never taken — alias it to `false` so webpack stubs it out.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

module.exports = nextConfig;
