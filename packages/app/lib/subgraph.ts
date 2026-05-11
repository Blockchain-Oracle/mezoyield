import type { Gauge, Address } from "@/lib/types";

/**
 * Goldsky subgraph client. Goldsky is a hackathon sponsor (per
 * `context/refs/sponsor-repos.md`); using their indexing earns sponsor
 * integration credit and reduces RPC roundtrips.
 *
 * The endpoint is configured via `NEXT_PUBLIC_GOLDSKY_GAUGES_URL`. It is
 * intentionally unset by default — Mezo hasn't published a canonical
 * subgraph for our optimizer's view of gauges, so STORY-005 ships with
 * the RPC fallback as the primary path. Once an endpoint is available
 * (sponsor channel, Mezo Discord), drop it into `.env.local` and the
 * `useGaugeData` hook will prefer it without any code change.
 *
 * `fetchGaugesFromSubgraph()` returns `null` to signal "no endpoint
 * configured" so the hook can fall through to the on-chain reader without
 * synthesizing placeholder data — the §14 grep gate forbids invented
 * gauge rows in this hot path.
 */
export async function fetchGaugesFromSubgraph(): Promise<Gauge[] | null> {
  const endpoint = process.env.NEXT_PUBLIC_GOLDSKY_GAUGES_URL;
  if (!endpoint) return null;

  const query = /* GraphQL */ `
    query Gauges {
      gauges(first: 100) {
        id
        name
        totalVeMezo
        bribeMUSD
      }
    }
  `;

  type SubgraphGauge = {
    id: string;
    name: string;
    totalVeMezo: string;
    bribeMUSD: string;
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(
      `Goldsky returned ${res.status} ${res.statusText} for the gauges query.`,
    );
  }
  const body = (await res.json()) as { data?: { gauges?: SubgraphGauge[] }; errors?: unknown[] };
  if (body.errors?.length) {
    throw new Error(
      `Goldsky subgraph returned errors: ${JSON.stringify(body.errors)}`,
    );
  }
  const rows = body.data?.gauges ?? [];
  return rows.map((g) => {
    const totalVeMezoWei = BigInt(g.totalVeMezo);
    const bribeMUSDWei = BigInt(g.bribeMUSD);
    return {
      address: g.id as Address,
      name: g.name,
      totalVeMezoWei,
      bribeMUSDWei,
      apyPercent: computeApy(bribeMUSDWei, totalVeMezoWei),
    };
  });
}

/**
 * Protocol-aggregate yield history fetched from Goldsky. Returns the
 * total MUSD claimed across ALL accounts on the optimizer, bucketed by
 * Unix-aligned epoch, plus the count of unique claimants.
 *
 * Endpoint env: `NEXT_PUBLIC_GOLDSKY_PROTOCOL_URL`. Unset by default,
 * same posture as `NEXT_PUBLIC_GOLDSKY_GAUGES_URL` — the protocol
 * subgraph isn't published yet, so the RPC fallback in
 * `useProtocolYieldHistory` is the primary path on the demo build. Drop
 * the URL into `.env.local` once a subgraph is published; the hook
 * picks it up without a code change.
 *
 * Returns `null` to signal "no endpoint configured" (so the hook falls
 * through cleanly), `[]` for "configured but no events yet", and throws
 * for network/HTTP errors.
 */
export type ProtocolYieldSubgraphResponse = {
  /** Per-epoch totals (epoch index = floor(ts / 604_800)). */
  epochs: Array<{ epoch: number; musdWei: bigint }>;
  /** Distinct claimants observed across the indexed window. */
  uniqueClaimants: number;
  /** Latest claim's blockTimestamp (Unix seconds). Anchor input. */
  anchorTimestamp: bigint;
};

export async function fetchProtocolYieldHistoryFromSubgraph(): Promise<ProtocolYieldSubgraphResponse | null> {
  const endpoint = process.env.NEXT_PUBLIC_GOLDSKY_PROTOCOL_URL;
  if (!endpoint) return null;

  const query = /* GraphQL */ `
    query ProtocolYieldHistory {
      rewardsClaimedAggregates(first: 200, orderBy: epoch, orderDirection: desc) {
        epoch
        totalMusd
      }
      protocolStats(id: "stats") {
        uniqueClaimants
        latestClaimTimestamp
      }
    }
  `;

  type Row = { epoch: string | number; totalMusd: string };
  type Stats = { uniqueClaimants: string | number; latestClaimTimestamp: string | number };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(
      `Goldsky returned ${res.status} ${res.statusText} for the protocol-yield query.`,
    );
  }
  const body = (await res.json()) as {
    data?: {
      rewardsClaimedAggregates?: Row[];
      protocolStats?: Stats | null;
    };
    errors?: unknown[];
  };
  if (body.errors?.length) {
    throw new Error(
      `Goldsky subgraph returned errors: ${JSON.stringify(body.errors)}`,
    );
  }
  const rows = body.data?.rewardsClaimedAggregates ?? [];
  const stats = body.data?.protocolStats ?? null;
  return {
    epochs: rows.map((r) => ({
      epoch: Number(r.epoch),
      musdWei: BigInt(r.totalMusd),
    })),
    uniqueClaimants: stats ? Number(stats.uniqueClaimants) : 0,
    anchorTimestamp: stats ? BigInt(stats.latestClaimTimestamp) : 0n,
  };
}

/**
 * APY formula from story-005:
 *   apyAnnualized = (bribeMUSD / totalVeMezo) * 52
 * Returned as a percentage (0–∞) rounded to one decimal. `null` when
 * `totalVeMezo` is zero (uninhabited gauge — division would NaN).
 *
 * Exposed here so the RPC fallback path can use the same math.
 */
export function computeApy(bribeMUSDWei: bigint, totalVeMezoWei: bigint): number | null {
  if (totalVeMezoWei === 0n) return null;
  // 18-decimal numerator and denominator cancel out, but we lose precision
  // if we truncate to bigint division. Convert through Number AFTER scaling
  // by 1e6 to retain ~6 significant digits without overflowing.
  const SCALE = 1_000_000n;
  const ratioScaled = (bribeMUSDWei * SCALE) / totalVeMezoWei;
  const ratio = Number(ratioScaled) / Number(SCALE);
  const apy = ratio * 52 * 100; // *52 weeks, *100 to express as a %
  return Math.round(apy * 10) / 10;
}
