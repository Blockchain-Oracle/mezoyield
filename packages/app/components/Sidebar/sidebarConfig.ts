import {
  LayoutDashboard,
  Sparkles,
  Trophy,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Sidebar grouping mirrors Mezo's section-scoped layout (Earn ▸ Lock/Vote/...).
 * Two grouped sections (Earn, Insights) plus two leaf entries (Dashboard,
 * Settings). Groups render as always-expanded — the active group is
 * highlighted via the parent's icon and the child sub-nav handles
 * within-group routing.
 */

export type NavLeaf = {
  label: string;
  href: string;
};

export type NavGroup = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: readonly NavLeaf[];
};

/**
 * Sub-nav items derived from the grouped NAV_GROUPS structure. Pages drop
 * these into `<SubNav items=…>` directly — single source of truth shared
 * between the sidebar tree and the in-page tab strip.
 */
export const EARN_SUBNAV: readonly NavLeaf[] = [
  { label: "Strategies", href: "/app/earn/strategies" },
  { label: "Gauges", href: "/app/earn/gauges" },
  { label: "My Vault", href: "/app/earn/vault" },
] as const;

export const INSIGHTS_SUBNAV: readonly NavLeaf[] = [
  { label: "Leaderboard", href: "/app/insights/leaderboard" },
  { label: "Bribe Market", href: "/app/insights/bribe-market" },
] as const;

export const NAV_GROUPS: readonly NavGroup[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  {
    label: "Earn",
    href: "/app/earn",
    icon: Sparkles,
    children: EARN_SUBNAV,
  },
  {
    label: "Insights",
    href: "/app/insights",
    icon: Trophy,
    children: INSIGHTS_SUBNAV,
  },
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
