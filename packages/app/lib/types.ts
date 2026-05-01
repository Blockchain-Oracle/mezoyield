/**
 * Domain types shared across hooks/components. Kept narrow on purpose —
 * frontend-only shapes; on-chain primitives stay as `bigint` until the
 * presentation layer.
 */

export type Address = `0x${string}`;

/** A single Mezo gauge as the dashboard sees it. */
export type Gauge = {
  /** On-chain gauge address (deterministic for testnet stand-ins; real on Tigris). */
  address: Address;
  /** Human-readable name from the gauge registry. */
  name: string;
  /** Total veMEZO weight currently allocated to this gauge (wei). */
  totalVeMezoWei: bigint;
  /** MUSD bribe pool currently posted at this gauge (wei). */
  bribeMUSDWei: bigint;
  /**
   * Annualized APY estimate, computed presentation-side as
   * `(bribe / totalVeMezo) * 52`. Story-005 spec formula.
   * Rounded to 1 decimal for display. Returns `null` when totalVeMezo == 0.
   */
  apyPercent: number | null;
};

/** A user's pinned weight on a particular gauge, in basis points (sum = 10_000). */
export type GaugeAllocationEntry = {
  gauge: Address;
  weightBps: number;
};

/** A complete user allocation as stored on-chain. */
export type UserAllocation = {
  user: Address;
  entries: GaugeAllocationEntry[];
};
