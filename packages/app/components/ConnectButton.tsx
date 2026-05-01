"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

// ConnectButton is mounted client-only. Two reasons:
//   1. wagmi/RainbowKit context is mounted post-hydration (see app/providers.tsx),
//      so a server render would see no context and throw.
//   2. Avoids leaking @mezo-org/passport's styletron-engine-monolithic onto the
//      server where it crashes accessing `document` at module load.
const ConnectButtonClient = dynamic(
  () =>
    import("@/components/ConnectButtonClient").then((m) => m.ConnectButtonClient),
  {
    ssr: false,
    loading: () => (
      <Button
        disabled
        className="bg-[#F7931A] text-black opacity-60"
        aria-busy="true"
      >
        Connect
      </Button>
    ),
  },
);

export function ConnectButton() {
  return <ConnectButtonClient />;
}
