import type { ReactNode } from "react";
import dynamic from "next/dynamic";

/**
 * App-shell layout — Neko-pattern fixed sidebar on the left, main
 * content offset by the sidebar's 270px width on lg+.
 *
 * Sidebar is dynamic({ssr:false}) because it calls wagmi's
 * `useAccount()` to render the wallet card; running that during the
 * static export prerender throws `WagmiProviderNotFoundError` (no
 * WagmiProvider in the server tree). Page content still SSRs.
 */
const Sidebar = dynamic(
  () => import("@/components/Sidebar/Sidebar").then((m) => m.Sidebar),
  {
    ssr: false,
    loading: () => <SidebarSkeleton />,
  },
);

function SidebarSkeleton() {
  return (
    <aside
      aria-hidden
      className="fixed left-0 top-0 z-40 hidden h-screen w-[270px] flex-col border-r border-sidebar-border bg-sidebar lg:flex"
    />
  );
}

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex min-h-screen w-full flex-1 flex-col px-6 py-8 lg:ml-[270px] lg:px-10">
        {children}
      </main>
    </div>
  );
}
