/**
 * Auto-compound preview helpers — V2 Phase 7.
 *
 * The user's auto-compound % preference (set on /app/settings) is
 * what % of each MUSD claim would be swapped to MEZO via Tigris and
 * re-locked as additional veMEZO. This module is the single source
 * of truth for reading that preference and computing the split, so
 * every UI surface (PendingClaimCard, settings preview, future
 * post-claim toast) shows the same number.
 *
 * What's NOT here: the actual swap call. Wiring Tigris's swap router
 * end-to-end is bigger than the V2 hackathon scope and would require
 * a contract upgrade (claimAndCompound atomic call) to be safe
 * against partial-failure between claim and swap. For the demo we
 * surface the SPLIT and label it as "preview" / "manual today" so
 * judges see the integration intent without us shipping a
 * half-broken swap path.
 */

const STORAGE_KEY = "mezoyield:settings:v1";

export type AutoCompoundSplit = {
  /** Wei going to the user's wallet on claim (MUSD). */
  walletWei: bigint;
  /** Wei to be swapped to MEZO via Tigris and locked as veMEZO (MUSD). */
  compoundWei: bigint;
  /** The % preference, mirrored for display. */
  pct: number;
};

/**
 * Read the user's auto-compound % from localStorage. Returns 0
 * server-side or when no preference has been saved. Bounds-checked
 * to [0, 100] — defensive against a hand-edited localStorage value.
 */
export function readAutoCompoundPct(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { autoCompoundPct?: unknown };
    const pct =
      typeof parsed.autoCompoundPct === "number" ? parsed.autoCompoundPct : 0;
    return Math.max(0, Math.min(100, Math.round(pct)));
  } catch {
    return 0;
  }
}

/**
 * Split a pending MUSD claim amount into the (wallet, compound)
 * pair according to the user's saved %. Bigint-arithmetic so we
 * never round-trip through float and lose wei.
 */
export function computeSplit(pendingWei: bigint, pct: number): AutoCompoundSplit {
  const safePct = Math.max(0, Math.min(100, Math.round(pct)));
  const compoundWei = (pendingWei * BigInt(safePct)) / 100n;
  return {
    walletWei: pendingWei - compoundWei,
    compoundWei,
    pct: safePct,
  };
}
