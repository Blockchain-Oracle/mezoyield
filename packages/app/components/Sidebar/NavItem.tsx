import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItemProps {
  label: string;
  href: string;
  icon: React.ElementType;
  isActive: boolean;
}

/**
 * Adapted from Neko's `NavItem.tsx` — same pill structure, same active
 * state (overlay surface, full pill radius). Now token-driven via
 * `bg-nav-active` so the pill stays legible in both light and dark
 * mode.
 */
export function NavItem({ label, href, icon: Icon, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors duration-150",
        isActive
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
      )}
      style={{ borderRadius: "84px" }}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/60",
        )}
      />
      {label}
    </Link>
  );
}
