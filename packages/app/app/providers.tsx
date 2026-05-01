"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// Mezo Passport pulls in styletron-engine-monolithic which touches `document`
// at module load — incompatible with Next.js SSR/prerender. Mount the entire
// wagmi/Passport/RainbowKit stack on the client only.
const ClientProviders = dynamic(
  () => import("@/components/Providers").then((m) => m.Providers),
  {
    ssr: false,
    loading: () => null,
  },
);

export function Providers({ children }: { children: ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
