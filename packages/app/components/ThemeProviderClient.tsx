"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Thin client wrapper around next-themes' ThemeProvider so the root
 * layout (a server component) can mount it without becoming a client
 * component itself. Crucially this lives OUTSIDE the lazy wagmi/Passport
 * provider stack from `app/providers.tsx` — that stack defers itself
 * until after hydration; we want theme switching to work from the very
 * first paint, including the SSR pass.
 *
 * `attribute="class"` lands `class="dark"` (or `class="light"`) on
 * <html>, which the @theme rules in globals.css key off. defaultTheme
 * matches the prior hardcoded "dark" so existing renders stay visually
 * identical until the user clicks the toggle.
 */
export function ThemeProviderClient({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
