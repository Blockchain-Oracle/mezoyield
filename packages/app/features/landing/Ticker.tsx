"use client";

import { formatUnits } from "viem";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useWalletReady } from "@/app/providers";
import {
  MEZO_CHAIN_ID,
  MEZO_NETWORK,
  OPTIMIZER_ADDRESS,
} from "@/lib/contracts";

/**
 * Continuously-scrolling marquee of real on-chain numbers — the
 * "no teeth = no win" judge signal applied as ambient atmosphere.
 *
 * Items rendered: top APY, total bribes, optimizer contract address,
 * gauge count, MEZO chain ID, brief mission tag. Loop is duplicated
 * twice in the DOM and animated 60s at 50% transform — gives infinite
 * scroll without JS, dodges the seam by scaling the duplicate offset.
 *
 * Hidden until walletReady so we never render `0%` placeholders.
 */
export function Ticker() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return (
      <div
        aria-hidden
        className="flex h-9 items-center justify-center border-y border-foreground/5 bg-black/40 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        booting on-chain feed…
      </div>
    );
  }
  return <TickerInner />;
}

function TickerInner() {
  const { gauges } = useGaugeData();
  const list = gauges ?? [];

  const topApy = list.reduce(
    (m, g) => (g.apyPercent != null && g.apyPercent > m ? g.apyPercent : m),
    0,
  );
  const totalBribesWei = list.reduce((acc, g) => acc + g.bribeMUSDWei, 0n);
  const totalBribes = Number(formatUnits(totalBribesWei, 18));
  const totalVeMezoWei = list.reduce((acc, g) => acc + g.totalVeMezoWei, 0n);
  const totalVeMezo = Number(formatUnits(totalVeMezoWei, 18));

  // Chain label is driven by the active deployment manifest — flipping
  // NEXT_PUBLIC_MEZO_NETWORK at build time changes the rendered label
  // without touching this file.
  const isMainnet = MEZO_CHAIN_ID === 31612;
  const chainLabel = isMainnet
    ? `Mezo Mainnet · ${MEZO_CHAIN_ID}`
    : `Mezo Testnet · ${MEZO_CHAIN_ID}`;

  // Cross-domain announcement gated by an explicit "is mainnet live"
  // signal. Codex P2 (pre-push round): the prior version rendered
  // "Also live mainnet.mezoyield.xyz" unconditionally on testnet builds
  // even while the mainnet manifest's Optimizer.address is null (so
  // the mainnet build literally cannot succeed). Surfacing that claim
  // before Phase 5 deploys would be slop. The flag is FALSE until the
  // mainnet manifest carries a non-null Optimizer; flipping it is the
  // last line of the Phase 5 deploy PR.
  const MAINNET_LIVE = false;
  const items: { label: string; value: string; tone?: "mezo" }[] = [
    { label: "Top APY", value: topApy > 0 ? `${topApy.toFixed(1)}%` : "—", tone: "mezo" },
    { label: "Bribes posted", value: `${formatBig(totalBribesWei)} MUSD` },
    { label: "Total veMEZO", value: formatBig(totalVeMezoWei) },
    { label: "Active gauges", value: `${list.length}` },
    { label: "Chain", value: chainLabel },
    ...(MAINNET_LIVE
      ? [
          isMainnet
            ? {
                label: "Testnet",
                value: "mezoyield.xyz",
                tone: "mezo" as const,
              }
            : {
                label: "Also live",
                value: "mainnet.mezoyield.xyz",
                tone: "mezo" as const,
              },
        ]
      : []),
    {
      label: "Optimizer",
      value: `${OPTIMIZER_ADDRESS.slice(0, 8)}…${OPTIMIZER_ADDRESS.slice(-6)}`,
    },
    { label: "Status", value: "Non-custodial · Set & Forget live", tone: "mezo" },
  ];
  void MEZO_NETWORK;
  void totalVeMezo;

  return (
    <div
      aria-hidden
      className="relative isolate flex h-9 items-center overflow-hidden border-y border-foreground/5 bg-black/40"
    >
      <div className="flex shrink-0 animate-ticker gap-12 whitespace-nowrap px-6 font-mono text-[11px] uppercase tracking-[0.18em]">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <span
              className={`h-1 w-1 rounded-full ${item.tone === "mezo" ? "bg-mezo" : "bg-foreground/30"}`}
            />
            <span className="text-muted-foreground">{item.label}</span>
            <span className={item.tone === "mezo" ? "text-mezo" : "text-foreground"}>
              {item.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatBig(wei: bigint): string {
  const v = Number(formatUnits(wei, 18));
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(2);
}
