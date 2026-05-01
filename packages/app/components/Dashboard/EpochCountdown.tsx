"use client";

import { useEpochCountdown } from "@/hooks/useEpochCountdown";

/**
 * Top-of-dashboard urgency signal: how long until the next voting epoch
 * boundary, with a bottom-up progress bar that fills as the epoch passes.
 * Story-006 BDD: visible regardless of wallet state (epoch is universal,
 * not user-specific).
 */
export function EpochCountdown() {
  const { label, progress } = useEpochCountdown();
  const pct = Math.round(progress * 100);

  return (
    <div
      data-testid="epoch-countdown"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-sm font-medium text-foreground" data-testid="epoch-countdown-label">
          {label}
        </div>
        <div className="font-mono text-xs text-muted-foreground">{pct}%</div>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-testid="epoch-countdown-progress"
          className="h-full rounded-full bg-[#F7931A] transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
