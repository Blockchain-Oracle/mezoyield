"use client";

import { useEffect, useState } from "react";

/**
 * 1-week epoch countdown for the dashboard. Anchors to wall-clock time
 * in seconds since the Unix epoch and computes the next epoch boundary
 * as `ceil(now / EPOCH_SECONDS) * EPOCH_SECONDS`.
 *
 * The hook re-renders every 1 second so the displayed remaining time
 * advances visibly. We use wall-clock instead of `useBlock()` because
 * Mezo testnet block times are short and noisy — a clean second-tick is
 * what the BDD's "X days, Y hours, Z minutes" requires, and it lines up
 * with what users see on every other countdown they've encountered.
 *
 * Story-006 BDD:
 *   - Shows "X days, Y hours, Z minutes until next epoch"
 *   - Progress bar fills 0–100% across the epoch duration
 *   - When countdown drops below 1 minute, label collapses to "<1 min"
 *     (no negative numbers)
 */

export const EPOCH_SECONDS = 7 * 24 * 60 * 60; // 604_800

export type EpochCountdown = {
  /** Seconds remaining until the next epoch boundary (>= 0). */
  remainingSeconds: number;
  /** Human label per the BDD ("X days, Y hours, Z minutes"). */
  label: string;
  /** 0..1 fractional progress through the current epoch. */
  progress: number;
};

export function computeEpochCountdown(nowSeconds: number, epochSeconds = EPOCH_SECONDS): EpochCountdown {
  const sinceLastBoundary = nowSeconds % epochSeconds;
  const remainingSeconds = Math.max(0, epochSeconds - sinceLastBoundary);
  const progress = Math.min(1, Math.max(0, sinceLastBoundary / epochSeconds));

  let label: string;
  if (remainingSeconds < 60) {
    label = "Epoch renews in <1 min";
  } else {
    const days = Math.floor(remainingSeconds / 86_400);
    const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
    const minutes = Math.floor((remainingSeconds % 3_600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    label = `${parts.join(" ")} until next epoch`;
  }

  return { remainingSeconds, label, progress };
}

export function useEpochCountdown(): EpochCountdown {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return computeEpochCountdown(now);
}
