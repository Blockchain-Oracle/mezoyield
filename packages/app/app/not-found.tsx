import Link from "next/link";
import { ArrowRight, MoveLeft } from "lucide-react";

/**
 * Global 404 fallback. Catches any unmatched route across the app —
 * including stale bookmarks to the old /app/strategies and /app/gauges
 * paths that didn't survive the earn/insights restructure.
 *
 * Tone is intentionally on-brand (Fraunces italic display, mono eyebrow,
 * Mezo coral accent) so even the dead-end surface keeps the receipts /
 * autopilot framing.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-20 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(ellipse_at_top,rgba(255,0,77,0.08),transparent_55%)]"
      />

      <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
        404 · Page off the gauge
      </p>

      <h1 className="mt-3 text-center font-display text-7xl font-medium leading-none tracking-tight sm:text-8xl">
        Nothing to <span className="italic">vote on</span> here.
      </h1>

      <p className="mt-6 max-w-xl text-center text-base text-muted-foreground">
        This page never delegated. Bookmarks from the old{" "}
        <code className="font-mono text-foreground">/app/strategies</code>{" "}
        or{" "}
        <code className="font-mono text-foreground">/app/gauges</code>{" "}
        paths live under{" "}
        <code className="font-mono text-foreground">/app/earn/…</code>{" "}
        now. Everything else is still where you left it.
      </p>

      <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row">
        <Link
          href="/app/dashboard"
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-mezo px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-mezo-hover"
        >
          Back to dashboard
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
        <Link
          href="/app/earn/strategies"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card/80"
        >
          <MoveLeft aria-hidden className="h-4 w-4" />
          Browse strategies
        </Link>
      </div>

      <p className="mt-12 max-w-md text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Receipts, not promises. The keeper kept voting while you were lost.
      </p>
    </main>
  );
}
