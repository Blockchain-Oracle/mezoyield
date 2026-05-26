"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SubNavItem {
  label: string;
  href: string;
}

interface SubNavProps {
  items: readonly SubNavItem[];
}

/**
 * Router-driven horizontal tab strip — mirrors Mezo's section sub-nav
 * (Lock | Vote | Pools | Vaults). Active item gets a 2px underline accent
 * in the brand color; inactive items are muted with a foreground hover.
 * Renders as a horizontal-scrollable strip on small screens so it never
 * wraps under the mobile header.
 */
export function SubNav({ items }: SubNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Section navigation"
      className="relative -mx-2 flex w-[calc(100%+1rem)] gap-1 overflow-x-auto border-b border-border px-2"
    >
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                active ? "bg-mezo" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
