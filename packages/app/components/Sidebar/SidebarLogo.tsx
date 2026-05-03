import Link from "next/link";

/**
 * Wordmark in the sidebar top. Neko's version uses an SVG image
 * (`/Neko.svg`); we don't have a logo asset yet, so a styled wordmark
 * stands in. Same outer Link + flex shape, same padding rhythm
 * (`pt-12 pb-6`).
 */
export function SidebarLogo() {
  return (
    <Link href="/" className="flex items-center pt-12 pb-6 px-5">
      <span className="font-display text-3xl font-medium tracking-tight text-white">
        Mezo<span className="text-mezo">Yield</span>
      </span>
    </Link>
  );
}
