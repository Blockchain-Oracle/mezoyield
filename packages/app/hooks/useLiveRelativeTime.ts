"use client";

import { useEffect, useState } from "react";
import { formatRelativeAgo } from "@/lib/format";

/**
 * Returns a "Xm Ys ago"-style string that re-renders on a 1s interval
 * so the UI shows live-aging timestamps without re-running the
 * underlying chain query.
 *
 * The pattern matters for receipt-style cards (ProofLedger, keeper
 * heartbeat chip): the underlying VoteCast event's block timestamp is
 * fixed, but the user's perception of "how recent" should advance with
 * the clock. Without this, "voted 2h ago" stays "2h ago" until the
 * next refetch hits — which on a 30s staleTime feels like the UI
 * froze. Cheap (one component re-render per second per consumer; no
 * RPC traffic).
 *
 * Pass `null`/`undefined` when the timestamp isn't loaded yet — the
 * hook returns `undefined` and skips the tick.
 */
export function useLiveRelativeTime(
  unixSeconds: bigint | number | null | undefined,
  intervalMs = 1000,
): string | undefined {
  const [_, setTick] = useState(0);

  useEffect(() => {
    if (unixSeconds === null || unixSeconds === undefined) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [unixSeconds, intervalMs]);

  if (unixSeconds === null || unixSeconds === undefined) return undefined;
  return formatRelativeAgo(unixSeconds);
}
