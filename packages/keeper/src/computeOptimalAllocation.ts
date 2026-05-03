import { type PublicClient } from "viem";
import { GAUGE_CONTROLLER_ADDRESS, MATCHBOX_ADDRESS } from "./config.js";

const TOTAL_BPS = 10_000n;

const gaugeControllerAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "gauges",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "gaugeMeta",
    inputs: [{ name: "gauge", type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "totalVeMezo", type: "uint256" },
    ],
  },
] as const;

const matchboxAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "bribeForGauge",
    inputs: [{ name: "gauge", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type GaugeInfo = {
  address: `0x${string}`;
  name: string;
  totalVeMezoWei: bigint;
  bribeMUSDWei: bigint;
};

export type Allocation = {
  gauges: `0x${string}`[];
  weights: bigint[];
};

/**
 * Reads every gauge from the controller, joins each with its current
 * Matchbox bribe, returns the live gauge set.
 *
 * Mirrors the frontend's useGaugeData RPC fallback path. Both must
 * yield the same data; the keeper's vote should match what the user
 * sees on the dashboard.
 */
export async function loadGauges(client: PublicClient): Promise<GaugeInfo[]> {
  const addresses = (await client.readContract({
    address: GAUGE_CONTROLLER_ADDRESS,
    abi: gaugeControllerAbi,
    functionName: "gauges",
  })) as readonly `0x${string}`[];

  const out: GaugeInfo[] = [];
  for (const g of addresses) {
    const meta = (await client.readContract({
      address: GAUGE_CONTROLLER_ADDRESS,
      abi: gaugeControllerAbi,
      functionName: "gaugeMeta",
      args: [g],
    })) as readonly [string, bigint];
    const bribe = (await client.readContract({
      address: MATCHBOX_ADDRESS,
      abi: matchboxAbi,
      functionName: "bribeForGauge",
      args: [g],
    })) as bigint;
    out.push({
      address: g,
      name: meta[0],
      totalVeMezoWei: meta[1],
      bribeMUSDWei: bribe,
    });
  }
  return out;
}

/**
 * Pure allocation algorithm — same logic as `packages/app/lib/optimize.ts`'s
 * autoAllocate, mirrored here so the keeper package doesn't import from the
 * Next.js app workspace (no React, no JSX, no client bundle).
 *
 *   score(g)        = bribe / totalVeMezo  (bigint, scaled 1e18)
 *   ranked          = gauges with score > 0, sorted by score desc
 *   weight(g)       = score(g) * TOTAL_BPS / sum(scores)
 *   drift           = TOTAL_BPS - sum(weights)  → onto the heaviest
 *   fallback        = if no gauges have bribes, pick the highest-veMEZO
 *                     gauge so we still cast a valid 100% allocation.
 */
export function computeOptimalAllocation(gauges: GaugeInfo[]): Allocation {
  if (gauges.length === 0) {
    return { gauges: [], weights: [] };
  }

  const SCALE = 10n ** 18n;
  const scored = gauges
    .map((g) => ({
      gauge: g,
      score:
        g.totalVeMezoWei === 0n
          ? 0n
          : (g.bribeMUSDWei * SCALE) / g.totalVeMezoWei,
    }))
    .filter((x) => x.score > 0n)
    .sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));

  if (scored.length === 0) {
    const fallback = [...gauges].sort((a, b) =>
      a.totalVeMezoWei < b.totalVeMezoWei
        ? 1
        : a.totalVeMezoWei > b.totalVeMezoWei
          ? -1
          : 0,
    )[0];
    return { gauges: [fallback.address], weights: [TOTAL_BPS] };
  }

  const totalScore = scored.reduce((acc, x) => acc + x.score, 0n);
  const entries = scored.map((x) => ({
    gauge: x.gauge.address,
    weight: (x.score * TOTAL_BPS) / totalScore,
  }));
  const drift = TOTAL_BPS - entries.reduce((acc, e) => acc + e.weight, 0n);
  if (drift !== 0n && entries.length > 0) {
    entries[0].weight += drift;
  }
  return {
    gauges: entries.map((e) => e.gauge),
    weights: entries.map((e) => e.weight),
  };
}
