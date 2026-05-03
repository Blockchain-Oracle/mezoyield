import type { ReactNode } from "react";
import dynamic from "next/dynamic";

/**
 * Adapted from Neko's `(app)/layout.tsx` — Sidebar on lg+, MobileHeader
 * (with hamburger drawer) under lg, main content offset by 270px on
 * lg+ and `pt-16` to clear the mobile header on small screens.
 *
 * Both are dynamic({ssr:false}) because they call wagmi's `useAccount`
 * to render the wallet card; running that during static export
 * prerender throws WagmiProviderNotFoundError.
 */
const Sidebar = dynamic(
  () => import("@/components/Sidebar/Sidebar").then((m) => m.Sidebar),
  {
    ssr: false,
    loading: () => (
      <aside
        aria-hidden
        className="fixed left-0 top-0 z-40 hidden h-screen w-[270px] flex-col border-r border-white/5 bg-[#121212] lg:flex"
      />
    ),
  },
);

const MobileHeader = dynamic(
  () => import("@/components/Sidebar/MobileHeader").then((m) => m.MobileHeader),
  {
    ssr: false,
    loading: () => (
      <header
        aria-hidden
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 bg-[#121212]"
      />
    ),
  },
);

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MobileHeader />
      <main
        className="pt-20 lg:pt-0 lg:ml-[270px] flex min-h-screen min-w-0 flex-1 flex-col items-stretch overflow-x-hidden text-white w-full"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex-1 px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
