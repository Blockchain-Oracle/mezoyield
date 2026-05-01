"use client";

import {
  ComponentType,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

// `@mezo-org/passport` pulls in `styletron-engine-monolithic`, which reads
// `document` at module load — incompatible with any SSR pass. So we lazy-import
// the wallet stack only on the client (after hydration) and let `children`
// render unwrapped during SSR. This preserves SSR'd HTML for the page chrome
// while keeping the wallet bundle out of the server runtime.
//
// `WalletReadyContext` reports whether the wagmi/RainbowKit/Passport stack is
// actually mounted around the current render. Wallet-using components MUST
// gate on `useWalletReady()` before calling RainbowKit/wagmi hooks — without
// the gate, a client-side race can resolve a wallet component's dynamic chunk
// before the provider Stack mounts, surfacing as "no WagmiProvider context"
// runtime errors. (Codex caught this on PR #18.)

type StackComponent = ComponentType<{ children: ReactNode }>;
let cachedStack: StackComponent | null = null;

const WalletReadyContext = createContext(false);

export function useWalletReady(): boolean {
  return useContext(WalletReadyContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [Stack, setStack] = useState<StackComponent | null>(cachedStack);

  useEffect(() => {
    if (cachedStack) return;
    let cancelled = false;
    import("@/components/Providers").then((mod) => {
      if (cancelled) return;
      cachedStack = mod.Providers as StackComponent;
      setStack(() => mod.Providers as StackComponent);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Stack) {
    return (
      <WalletReadyContext.Provider value={false}>
        {children}
      </WalletReadyContext.Provider>
    );
  }

  return (
    <WalletReadyContext.Provider value={true}>
      <Stack>{children}</Stack>
    </WalletReadyContext.Provider>
  );
}
