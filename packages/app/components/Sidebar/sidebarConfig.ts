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
 * MezoYield V2 sidebar destinations. Order is the visual order in the
 * left-rail. Active-route detection lives in `Sidebar.tsx`.
 *
 * Adapted from `context/refs/repos/neko/.../sidebarConfig.ts` — same
 * shape (label + href + icon), pruned to our 7 destinations.
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

export const SIDEBAR_WIDTH = 270;
