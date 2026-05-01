"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useWalletReady } from "@/app/providers";

// ConnectButton is mounted client-only AND gated on the wallet provider stack
// being live. Three things have to be true before the inner RainbowKit-using
// component can mount:
//   1. We're on the client (no SSR — @mezo-org/passport's transitive
//      styletron-engine-monolithic reads `document` at module load).
//   2. The dynamic chunk for ConnectButtonClient has resolved.
//   3. WagmiProvider/RainbowKitProvider/QueryClientProvider are wrapping us
//      (i.e. `useWalletReady()` returns true) — otherwise RainbowKit hooks
//      throw "no WagmiProvider context". Codex flagged this race on PR #18.
const ConnectButtonClient = dynamic(
  () =>
    import("@/components/ConnectButtonClient").then((m) => m.ConnectButtonClient),
  {
    ssr: false,
    loading: () => <ConnectSkeleton />,
  },
);

function ConnectSkeleton() {
  return (
    <Button
      disabled
      className="bg-[#F7931A] text-black opacity-60"
      aria-busy="true"
    >
      Connect
    </Button>
  );
}

export function ConnectButton() {
  const ready = useWalletReady();
  if (!ready) return <ConnectSkeleton />;
  return <ConnectButtonClient />;
}
