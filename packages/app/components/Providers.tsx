"use client";

import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";

import { wagmiConfig, mezoTestnet } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const { resolvedTheme } = useTheme();
  // Sonner's `theme` prop drives its built-in palette. Mirror next-themes'
  // resolved value so toasts track the rest of the UI without us reaching
  // for hardcoded hex.
  const toasterTheme = resolvedTheme === "light" ? "light" : "dark";

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={mezoTestnet}>
          {children}
          <Toaster
            theme={toasterTheme}
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
