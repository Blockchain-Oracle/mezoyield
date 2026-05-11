import Link from "next/link";
import { NetworkPill } from "./NetworkPill";

/**
 * Sidebar header strip. AppHeader is NOT mounted on /app/* routes
 * (the sidebar owns navigation here), so the wordmark + NetworkPill
 * both live in the sidebar top.
 */
export function SidebarLogo() {
  return (
    <div className="flex flex-col items-start gap-2.5 pt-12 pb-6 px-5">
      <Link href="/" className="flex items-center" aria-label="MezoYield home">
        <span className="font-display text-3xl font-medium tracking-tight text-sidebar-foreground">
          Mezo<span className="text-mezo">Yield</span>
        </span>
      </Link>
      <NetworkPill />
    </div>
  );
}
