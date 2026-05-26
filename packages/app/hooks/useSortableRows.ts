import { useMemo, useState } from "react";
import { formatUnits } from "viem";

export type SortDir = "asc" | "desc";

interface UseSortableRowsResult<T> {
  sorted: T[];
  sortKey: keyof T;
  sortDir: SortDir;
  toggle: (key: keyof T) => void;
}

/**
 * Generic per-row sort hook. Returns a stable sorted copy of `rows` plus
 * the current sort key/direction and a toggle handler.
 *
 * `toggle(key)`:
 *   - same key as current → flip direction (asc↔desc)
 *   - different key → switch to that key with the default direction
 *
 * Type handling (in compareValues, direction-aware):
 *   - bigint → ordered by `Number(formatUnits(_, 18))` (lossy for display,
 *              fine for ordering)
 *   - number → numeric ascending
 *   - string → locale `localeCompare` (case-folded)
 *   - null / undefined → always last, regardless of direction
 *
 * Each consuming table writes its own inline `<SortHeader>` markup with
 * `aria-sort` on the `<TableHead>` — a generic `<SortableTable>` would
 * over-abstract for hackathon scope (cell shapes diverge per table).
 */
export function useSortableRows<T extends object>(
  rows: readonly T[],
  defaultKey: keyof T,
  defaultDir: SortDir = "desc",
): UseSortableRowsResult<T> {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    const copy = rows.slice();
    copy.sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDir));
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggle(key: keyof T) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  }

  return { sorted, sortKey, sortDir, toggle };
}

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  // Nulls always last, regardless of direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const cmp = rawCompare(a, b);
  return dir === "asc" ? cmp : -cmp;
}

function rawCompare(a: unknown, b: unknown): number {
  if (typeof a === "bigint" && typeof b === "bigint") {
    const an = Number(formatUnits(a, 18));
    const bn = Number(formatUnits(b, 18));
    return an < bn ? -1 : an > bn ? 1 : 0;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}
