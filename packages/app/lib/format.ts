import { formatUnits } from "viem";

/**
 * Display formatters used across the dApp. Centralized so the
 * dashboard, leaderboard, gauge tables, charts, and modals all
 * speak the same MUSD / address dialect. Previously each consumer
 * inlined `Number(formatUnits(wei, 18)).toFixed(2)` with subtle
 * variations (`toFixed(0)`, `toLocaleString()`, etc.) — that's
 * how "$8400 in one card vs 8,400 in another" inconsistencies
 * sneak in.
 *
 * MUSD precision is 18 decimals (standard ERC-20). veMEZO + the
 * VeMezoVotingPower shim both also use 18 decimals.
 */

const MUSD_DECIMALS = 18;

/** "8,400.00 MUSD" — 2dp, locale-grouped, suffix-free for raw use. */
export function formatMUSD(wei: bigint, opts?: { withSuffix?: boolean }): string {
  const n = Number(formatUnits(wei, MUSD_DECIMALS));
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return opts?.withSuffix ? `${formatted} MUSD` : formatted;
}

/** Whole MUSD with locale grouping — "8,400". Useful for hero metrics. */
export function formatMUSDWhole(wei: bigint): string {
  const n = Number(formatUnits(wei, MUSD_DECIMALS));
  return Math.round(n).toLocaleString();
}

/** veMEZO formatted same as MUSD (also 18dp). Suffix configurable. */
export function formatVeMezo(wei: bigint, opts?: { withSuffix?: boolean }): string {
  return formatMUSD(wei, opts).replace(/ MUSD$/, opts?.withSuffix ? " veMEZO" : "");
}

/** Compact address: `0xAbCd…1234` (6+4). Default for tables, lists. */
export function formatAddressShort(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Long address: `0xAbCdEf…123456` (8+6). For receipt-style identity cells. */
export function formatAddressLong(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/**
 * Live-tickable "X ago" formatter. Returns a string from a unix
 * timestamp (seconds). Callers re-render on a 1s interval via
 * `useLiveRelativeTime` to keep the label fresh without rerunning
 * the underlying fetch.
 */
export function formatRelativeAgo(unixSeconds: bigint | number, nowMs?: number): string {
  const past = typeof unixSeconds === "bigint" ? Number(unixSeconds) : unixSeconds;
  const now = (nowMs ?? Date.now()) / 1000;
  const delta = Math.max(0, Math.floor(now - past));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) {
    const m = Math.floor(delta / 60);
    const s = delta % 60;
    return s === 0 ? `${m}m ago` : `${m}m ${s}s ago`;
  }
  if (delta < 86400) {
    const h = Math.floor(delta / 3600);
    const m = Math.floor((delta % 3600) / 60);
    return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
  }
  const d = Math.floor(delta / 86400);
  const h = Math.floor((delta % 86400) / 3600);
  return h === 0 ? `${d}d ago` : `${d}d ${h}h ago`;
}
