"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { NAV_ITEMS } from "./sidebarConfig";
import { SidebarLogo } from "./SidebarLogo";
import { NavItem } from "./NavItem";
import { ConnectedCard } from "./ConnectedCard";
import { SetupCard } from "./SetupCard";

export const SIDEBAR_WIDTH = "270px";

/**
 * Adapted from Neko's `Sidebar.tsx` — same fixed-left rail, same
 * 270px width, same border-r `border-white/5` on `bg-[#121212]`,
 * same logo / nav / wallet-card composition. Stellar `useStellarWallet`
 * + `useWalletType` hooks are replaced with wagmi's `useAccount` +
 * `useDisconnect`.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const activeAddress = address ?? "";
  const navItems = useMemo(() => NAV_ITEMS, []);

  const handleDisconnect = () => {
    disconnect();
  };

  const isActive = (href: string) =>
    href === "/app/dashboard"
      ? pathname === "/app/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[270px] flex-col border-r border-white/5 bg-[#121212]">
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

      <div className="p-4 pt-6 overflow-y-auto">
        {isConnected && activeAddress ? (
          <ConnectedCard
            address={activeAddress}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <SetupCard />
        )}
      </div>
    </aside>
  );
}
