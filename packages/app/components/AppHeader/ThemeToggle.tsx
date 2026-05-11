"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Theme toggle — next-themes canonical pattern. Gates icon render on
 * a `mounted` flag so SSR HTML doesn't lock in a Sun/Moon mismatch
 * before next-themes resolves the active theme (which can come from
 * localStorage or the system pref). Pre-mount we render a same-shape
 * placeholder so layout doesn't shift.
 *
 * `resolvedTheme` is preferred over `theme` because `theme` may be
 * "system"; we want the active mode for click semantics.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === "light";
  const Icon = isLight ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/40 text-foreground/80 transition-colors hover:border-mezo/40 hover:bg-card hover:text-foreground"
    >
      {mounted ? (
        <Icon aria-hidden className="h-4 w-4" />
      ) : (
        // Placeholder: same outer shape, no icon, prevents SSR hydration
        // mismatch (server doesn't know which icon to draw).
        <span aria-hidden className="h-4 w-4" />
      )}
    </button>
  );
}
