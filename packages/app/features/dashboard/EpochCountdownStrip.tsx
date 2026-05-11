"use client";

import { useEpochCountdown } from "@/hooks/useEpochCountdown";

/**
 * Inline epoch countdown strip — label on the left, progress bar
 * underneath. Sits at the top of /app/dashboard so the user always
 * sees how long until the next vote / claim cycle.
 *
 * The 1s tick comes from useEpochCountdown's internal interval; we
 * just consume the result.
 */
export function EpochCountdownStrip() {
  const { label, progress } = useEpochCountdown();
  const pct = Math.round(progress * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Epoch
          </span>
          <span className="font-mono text-base text-foreground">{label}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {pct}% through this week
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div
          aria-hidden
          className="h-full rounded-full bg-mezo transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
