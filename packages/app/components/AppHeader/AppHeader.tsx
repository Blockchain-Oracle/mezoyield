"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { NetworkPill } from "@/components/Sidebar/NetworkPill";
import { ConnectButton } from "@/components/ConnectButton";

/**
 * AppHeader — persistent horizontal top bar. Two variants:
 *
 *   - "full":    used inside /app/* above the Sidebar. Shows the
 *                wordmark, the in-app primary nav (Dashboard /
 *                Strategies / Gauges / Docs), the network pill, the
 *                theme toggle, and the wallet connect slot.
 *
 *   - "landing": used at the top of the marketing surface (`/`, `/docs`).
 *                A thinner shape: wordmark on the left, Docs link in
 *                the middle, theme toggle + a Launch app CTA on the
 *                right. No wallet connect (the Hero owns the primary
 *                Launch action).
 *
 * Sticky to the top of the viewport so it scrolls with the page (still
 * "persistent app chrome" — visible at all times when not below the
 * fold). Falls back to wordmark + theme toggle on mobile in the landing
 * variant; the /app/* mobile experience is owned by MobileHeader.
 */

type Variant = "landing" | "full";

const APP_NAV: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Dashboard", href: "/app/dashboard" },
  { label: "Strategies", href: "/app/earn/strategies" },
  { label: "Gauges", href: "/app/earn/gauges" },
  { label: "Docs", href: "/docs" },
];

export function AppHeader({ variant }: { variant: Variant }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  if (variant === "landing") {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center"
            aria-label="MezoYield home"
          >
            <span className="font-display text-xl font-medium tracking-tight text-foreground">
              Mezo<span className="text-mezo">Yield</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/docs"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Docs
            </Link>
            <ThemeToggle />
            <Link
              href="/app/dashboard"
              className="group inline-flex items-center gap-1.5 rounded-md bg-mezo px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-mezo-hover sm:px-4 sm:py-2"
            >
              Launch app
              <ArrowRight
                aria-hidden
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // Full variant — only renders on lg+ inside /app/*; MobileHeader owns the
  // small-screen experience for the app shell.
  return (
    <header className="hidden lg:flex sticky top-0 z-30 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="MezoYield home"
        >
          <span className="font-display text-xl font-medium tracking-tight text-foreground">
            Mezo<span className="text-mezo">Yield</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {APP_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-nav-active text-foreground"
                  : "text-muted-foreground hover:bg-nav-active/60 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NetworkPill />
          <ThemeToggle />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
