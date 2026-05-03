import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: boolean;
}

/**
 * Sidebar nav item — pill row with icon + label.
 * Active state: filled mezo background; inactive: muted text that
 * lights up on hover. Adapted from Neko's NavItem with our palette.
 */
export function NavItem({ label, href, icon: Icon, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-mezo-soft text-mezo"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-mezo" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span>{label}</span>
    </Link>
  );
}
