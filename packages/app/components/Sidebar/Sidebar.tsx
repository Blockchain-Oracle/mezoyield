"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { NAV_ITEMS } from "./sidebarConfig";
import { SidebarLogo } from "./SidebarLogo";
import { NavItem } from "./NavItem";
import { ConnectedCard } from "./ConnectedCard";
import { SetupCard } from "./SetupCard";
import { ThemeToggle } from "@/components/AppHeader/ThemeToggle";

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
  const navItems = useMemo(() => NAV_ITEMS, []);

  const isActive = (href: string) =>
    href === "/app/dashboard"
      ? pathname === "/app/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[270px] flex-col border-r border-border bg-sidebar">
      <SidebarLogo />

      <nav className="flex flex-1 flex-col gap-1 px-3 min-h-0 overflow-y-auto">
        {navItems.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            label={label}
            href={href}
            icon={icon}
            isActive={isActive(href)}
          />
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
