import Link from "next/link";

/**
 * Wordmark + tagline at the top of the sidebar. Clicking it goes home
 * (the landing page), matching the convention from Neko / Tigris where
 * the brand mark in the rail returns you to the marketing surface.
 */
export function SidebarLogo() {
  return (
    <Link
      href="/"
      className="flex flex-col gap-0.5 px-5 py-6 transition-opacity hover:opacity-80"
    >
      <span className="font-sans text-lg font-semibold tracking-tight text-foreground">
        MezoYield
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mezo">
        Set & Forget MUSD
      </span>
    </Link>
  );
}
