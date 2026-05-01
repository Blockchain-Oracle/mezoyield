"use client";

import { ComponentType, ReactNode, useEffect, useState } from "react";

// `@mezo-org/passport` pulls in `styletron-engine-monolithic`, which reads
// `document` at module load — incompatible with any SSR pass. So we lazy-import
// the wallet stack only on the client (after hydration) and let `children`
// render unwrapped during SSR. This preserves SSR'd HTML for the page chrome
// while keeping the wallet bundle out of the server runtime.
//
// Components that need wagmi context (ConnectButton + later wagmi-hook
// callsites) must be safe to render WITHOUT context for one render — we do
// this by wrapping them in `next/dynamic({ ssr: false })` so they're null
// until the client mounts the stack.

type StackComponent = ComponentType<{ children: ReactNode }>;
let cachedStack: StackComponent | null = null;

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

  if (!Stack) return <>{children}</>;
  return <Stack>{children}</Stack>;
}
