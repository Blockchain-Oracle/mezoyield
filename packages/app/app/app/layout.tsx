import type { ReactNode } from "react";

/**
 * App-shell layout. Phase 1 will swap this stub for the Neko-style
 * 270px sidebar pattern (Sidebar / NavItem / ConnectedCard / SetupCard).
 * Stubbed here so the route tree builds during Phase 0.
 */
export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-6 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mezo">
          MezoYield · sidebar pending (Phase 1)
        </p>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
