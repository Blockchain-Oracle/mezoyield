"use client";

import { useEpochCountdown } from "@/hooks/useEpochCountdown";
import { useLastVote } from "@/hooks/useLastVote";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";

const SEVEN_DAYS_SECONDS = 7n * 86_400n;

/**
 * Inline epoch countdown strip — label + progress bar + live keeper
 * heartbeat. Sits at the top of /app/dashboard so the user always
 * sees (a) how long until the next vote/claim cycle and (b) whether
 * the keeper is actually alive.
 *
 * The 1s tick for the epoch label comes from useEpochCountdown's
 * internal interval; the keeper-ago label uses useLiveRelativeTime
 * (also 1s).
 */
export function EpochCountdownStrip() {
  const { label, progress } = useEpochCountdown();
  const { vote, isLoading } = useLastVote();
  const ago = useLiveRelativeTime(vote?.blockTimestamp);
  const pct = Math.round(progress * 100);

  // Warn when the last vote is older than a full epoch — keeper is
  // probably stuck, demo will look broken without surfacing it.
  const isStale =
    vote && Date.now() / 1000 - Number(vote.blockTimestamp) > Number(SEVEN_DAYS_SECONDS);

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
      <KeeperHeartbeat
        ago={ago}
        isLoading={isLoading && !vote}
        isStale={!!isStale}
      />
    </div>
  );
}

function KeeperHeartbeat({
  ago,
  isLoading,
  isStale,
}: {
  ago: string | undefined;
  isLoading: boolean;
  isStale: boolean;
}) {
  const dotClass = isLoading
    ? "bg-muted-foreground/40 animate-pulse"
    : isStale
      ? "bg-warning"
      : ago
        ? "bg-success"
        : "bg-muted-foreground/30";
  const text = isLoading
    ? "Checking keeper…"
    : ago
      ? `Keeper voted ${ago}`
      : "No keeper votes yet";
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`}
      />
      <span className={isStale ? "text-warning" : undefined}>{text}</span>
    </div>
  );
}
