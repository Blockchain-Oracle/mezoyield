"use client";

import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useWalletReady } from "@/app/providers";
import { NAV_ITEMS, SIDEBAR_WIDTH } from "./sidebarConfig";
import { NavItem } from "./NavItem";
import { SidebarLogo } from "./SidebarLogo";
import { ConnectedCard } from "./ConnectedCard";
import { SetupCard } from "./SetupCard";
import type { Address } from "@/lib/types";

/**
 * Left rail navigation. 270px fixed on lg+, hidden under lg (the
 * MobileHeader handles small screens — Phase 1.5 if we need it).
 *
 * Active-route detection: a destination is active when the current
 * pathname IS that href OR starts with `${href}/` (covers nested
 * routes like /app/strategies/[strategyId] when those land).
 */
export function Sidebar() {
  const pathname = usePathname();
  const walletReady = useWalletReady();
  const { address, isConnected } = useAccount();

  const isActive = (href: string): boolean => {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      aria-label="Primary"
      className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar lg:flex"
      style={{ width: `${SIDEBAR_WIDTH}px` }}
    >
      <SidebarLogo />

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
            isActive={isActive(item.href)}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        {/* Render SetupCard during SSR / wallet-ready hydration so the
         * disconnected branch never throws inside RainbowKit. Once
         * walletReady is true and wagmi reports a connected account we
         * swap to ConnectedCard. */}
        {walletReady && isConnected && address ? (
          <ConnectedCard address={address as Address} />
        ) : (
          <SetupCard />
        )}
      </div>
    </aside>
  );
}
