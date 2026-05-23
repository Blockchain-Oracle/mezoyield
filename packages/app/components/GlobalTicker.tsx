"use client";

import { formatUnits } from "viem";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useLastVote } from "@/hooks/useLastVote";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { useWalletReady } from "@/app/providers";
import {
  MEZO_CHAIN_ID,
  MEZO_EXPLORER,
  MEZO_NETWORK,
  OPTIMIZER_ADDRESS,
} from "@/lib/contracts";

/**
 * Bloomberg-style top-of-page ticker. Mounts once at the root of the
 * app shell so it persists across every route — landing, dashboard,
 * strategies, vault, settings. Always sits at the top of the viewport
 * above the header.
 *
 * Behavior:
 *   - Continuously scrolls horizontally (45s loop) — see
 *     `.animate-ticker` keyframes in `globals.css`.
 *   - Pauses on hover so a user can stop and read mid-item.
 *   - Items that point at on-chain things (optimizer address, last
 *     keeper tx hash) are real `<a>` tags to the Mezo explorer.
 *   - Everything else is real on-chain data via wagmi reads — no
 *     synthesized numbers. Aria-live polite so screen readers
 *     announce updates without being noisy.
 */

const SHORT_OPTIMIZER = `${OPTIMIZER_ADDRESS.slice(0, 8)}…${OPTIMIZER_ADDRESS.slice(-6)}`;
// Single-network product: keeper runs on Mezo Mainnet only. UI never
// references testnet to a visitor. (The testnet build still exists
// internally for sandbox work; it just doesn't appear in this strip.)
void MEZO_CHAIN_ID;
void MEZO_NETWORK;

type Item =
  | { kind: "text"; label: string; value: string; tone?: "mezo" | "muted" }
  | { kind: "link"; label: string; value: string; href: string; tone?: "mezo" | "muted" };

function formatBig(wei: bigint): string {
  const v = Number(formatUnits(wei, 18));
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(2);
}

export function GlobalTicker() {
  // wagmi/react-query providers are inside a lazy boundary so the
  // first-paint SSR doesn't pull in the heavy wallet stack. Until the
  // ready signal fires, calling `useGaugeData` (which uses `useQuery`)
  // throws "No QueryClient set". Render the booting strip until ready.
  const walletReady = useWalletReady();
  if (!walletReady) return <TickerBoot />;
  return <TickerInner />;
}

function TickerBoot() {
  return (
    <aside
      aria-hidden
      className="ticker-container sticky top-0 z-50 flex h-8 w-full items-center justify-center overflow-hidden border-b border-foreground/10 bg-black/85 backdrop-blur-sm"
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        · booting on-chain feed · live on mainnet · mainnet.mezoyield.xyz ·
      </span>
    </aside>
  );
}

function TickerInner() {
  const { gauges } = useGaugeData();
  const { vote } = useLastVote();
  const lastVoteAgo = useLiveRelativeTime(vote?.blockTimestamp ?? null);
  const list = gauges ?? [];

  const topApy = list.reduce(
    (m, g) => (g.apyPercent != null && g.apyPercent > m ? g.apyPercent : m),
    0,
  );
  const totalBribesWei = list.reduce((acc, g) => acc + g.bribeMUSDWei, 0n);
  const totalVeMezoWei = list.reduce((acc, g) => acc + g.totalVeMezoWei, 0n);

  const items: Item[] = [
    {
      kind: "link",
      label: "Live on Mainnet",
      value: "mainnet.mezoyield.xyz",
      href: "https://mainnet.mezoyield.xyz",
      tone: "mezo",
    },
    { kind: "text", label: "Top APY", value: topApy > 0 ? `${topApy.toFixed(1)}%` : "—", tone: "mezo" },
    { kind: "text", label: "Bribes posted", value: `${formatBig(totalBribesWei)} MUSD` },
    { kind: "text", label: "Total veMEZO", value: formatBig(totalVeMezoWei) },
    { kind: "text", label: "Active gauges", value: `${list.length}` },
    {
      kind: "link",
      label: "Optimizer",
      value: SHORT_OPTIMIZER,
      href: `${MEZO_EXPLORER}/address/${OPTIMIZER_ADDRESS}`,
    },
    ...(vote
      ? ([
          {
            kind: "link" as const,
            label: "Last keeper tx",
            value: `${vote.txHash.slice(0, 10)}…${vote.txHash.slice(-6)}${lastVoteAgo ? ` · ${lastVoteAgo}` : ""}`,
            href: `${MEZO_EXPLORER}/tx/${vote.txHash}`,
            tone: "mezo" as const,
          },
        ] as Item[])
      : []),
  ];

  // Duplicate the items array so the CSS `translateX(-50%)` loop is
  // seamless — when the first copy slides off the left edge the second
  // copy is right where it was, no visible seam.
  const doubled = [...items, ...items];

  return (
    <aside
      aria-label="MezoYield live on-chain ticker"
      className="ticker-container sticky top-0 z-50 flex h-8 w-full items-center overflow-hidden border-b border-foreground/10 bg-black/85 backdrop-blur-sm"
    >
      <div
        className="flex shrink-0 animate-ticker gap-10 whitespace-nowrap px-6 font-mono text-[10.5px] uppercase tracking-[0.18em] leading-none"
        aria-live="polite"
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-1 w-1 rounded-full ${item.tone === "mezo" ? "bg-mezo" : "bg-foreground/30"}`}
            />
            <span className="text-muted-foreground">{item.label}</span>
            {item.kind === "link" ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline-offset-2 transition-colors hover:underline ${item.tone === "mezo" ? "text-mezo hover:text-mezo-hover" : "text-foreground hover:text-mezo"}`}
              >
                {item.value}
              </a>
            ) : (
              <span className={item.tone === "mezo" ? "text-mezo" : "text-foreground"}>
                {item.value}
              </span>
            )}
          </span>
        ))}
      </div>
    </aside>
  );
}
