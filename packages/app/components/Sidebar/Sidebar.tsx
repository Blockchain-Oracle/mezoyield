"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { NAV_GROUPS, type NavGroup } from "./sidebarConfig";
import { SidebarLogo } from "./SidebarLogo";
import { NavItem } from "./NavItem";
import { ConnectedCard } from "./ConnectedCard";
import { SetupCard } from "./SetupCard";
import { ThemeToggle } from "@/components/AppHeader/ThemeToggle";
import { cn } from "@/lib/utils";

/**
 * Adapted from Neko's `Sidebar.tsx` — same fixed-left rail, same
 * 270px width, same border-r `border-border` on `bg-sidebar`,
 * same logo / nav / wallet-card composition.
 *
 * Wagmi hooks (useAccount / useDisconnect) live in `WalletStateCard`
 * which only renders when `useWalletReady()` is true. The lazy-loaded
 * provider stack in `app/providers.tsx` mounts WagmiProvider on the
 * client AFTER hydration; calling wagmi hooks before that throws
 * `WagmiProviderNotFoundError`. The gate prevents the race.
 */
export function Sidebar() {
  const pathname = usePathname();
  const walletReady = useWalletReady();
  const groups = useMemo(() => NAV_GROUPS, []);

  const isActive = (href: string) =>
    href === "/app/dashboard"
      ? pathname === "/app/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[270px] flex-col border-r border-border bg-sidebar">
      <SidebarLogo />

      <nav className="flex flex-1 flex-col gap-1 px-3 min-h-0 overflow-y-auto">
        {groups.map((group) => (
          <SidebarGroup key={group.href} group={group} isActive={isActive} />
        ))}
      </nav>

      <div className="px-4 pb-3">
        <ThemeToggle />
      </div>

      <div className="p-4 pt-3 overflow-y-auto">
        {walletReady ? <WalletStateCard /> : <SetupCardSkeleton />}
      </div>
    </aside>
  );
}

/**
 * Renders a single sidebar group. Leaf groups (no `children`) render as a
 * plain NavItem. Grouped entries render the parent pill (active when any
 * descendant route matches) plus a static list of indented child links
 * (always-expanded, no collapse state to persist).
 */
function SidebarGroup({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
}) {
  if (!group.children) {
    return (
      <NavItem
        label={group.label}
        href={group.href}
        icon={group.icon}
        isActive={isActive(group.href)}
      />
    );
  }
  const parentActive = isActive(group.href);
  return (
    <div className="space-y-0.5">
      <NavItem
        label={group.label}
        href={group.children[0]!.href}
        icon={group.icon}
        isActive={parentActive}
      />
      <div className="ml-5 flex flex-col gap-0.5 border-l border-border/40 pl-3">
        {group.children.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            className={cn(
              "px-3 py-1.5 text-sm transition-colors rounded-md",
              isActive(child.href)
                ? "text-foreground font-medium"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
            )}
          >
            {child.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Inner wallet card — only mounted once the wallet provider stack is
 * live, so wagmi hooks won't throw. Connected → ConnectedCard;
 * disconnected → SetupCard (which itself uses `useConnectModal`,
 * also requiring the provider stack).
 */
function WalletStateCard() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <ConnectedCard
        address={address}
        onDisconnect={() => disconnect()}
      />
    );
  }
  return <SetupCard />;
}

/**
 * Visual placeholder for the wallet card while the provider stack is
 * still resolving. Same outer geometry as SetupCard (rounded gray
 * rectangle) so the sidebar layout doesn't jump on hydration.
 */
function SetupCardSkeleton() {
  return (
    <div
      aria-hidden
      className="rounded-[20px] bg-muted/60 p-5 animate-pulse"
      style={{ minHeight: 140 }}
    />
  );
}
