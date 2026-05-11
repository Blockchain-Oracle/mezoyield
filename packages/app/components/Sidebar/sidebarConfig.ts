import {
  LayoutDashboard,
  Sparkles,
  Vote,
  Vault,
  Trophy,
  Coins,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Adapted verbatim from Neko's `sidebarConfig.ts` — same shape (label
 * + href + icon), same exported style constants. Pruned to our 7
 * destinations and swapped Neko's blue (#229EDF) accent for the Mezo
 * brand color (#FF004D, sourced from mezo-org/tigris).
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Strategies", href: "/app/strategies", icon: Sparkles },
  { label: "Gauges", href: "/app/gauges", icon: Vote },
  { label: "My Vault", href: "/app/vault", icon: Vault },
  { label: "Leaderboard", href: "/app/leaderboard", icon: Trophy },
  { label: "Bribe Market", href: "/app/bribe-market", icon: Coins },
  { label: "Settings", href: "/app/settings", icon: Settings },
] as const;

/** Used by ConnectedCard / SetupCard. Token-driven so the card stays
 *  readable in both light and dark mode (Neko shipped a fixed light-gray
 *  card on a dark surface; we keep the visual weight but track theme). */
export const CARD_STYLES =
  "rounded-[20px] bg-card text-card-foreground p-5 border border-border" as const;

/** Used by ConnectedCard / SetupCard. Mezo brand-coloured pill button. */
export const CARD_BUTTON_STYLES =
  "flex w-full items-center justify-between rounded-full bg-pill-base px-5 py-3 text-sm font-semibold text-foreground cursor-pointer" as const;
