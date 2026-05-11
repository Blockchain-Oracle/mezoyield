"use client";

import { ArrowUpRight, ExternalLink, Receipt } from "lucide-react";
import { useLastVote } from "@/hooks/useLastVote";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useWalletReady } from "@/app/providers";
import {
  MEZO_EXPLORER,
  OPTIMIZER_ADDRESS,
} from "@/lib/contracts";
import type { Address, Gauge } from "@/lib/types";

/**
 * Receipts. The whole pitch ("MezoYield votes for you each epoch") is
 * a claim until the chain says otherwise — this section is the chain
 * saying otherwise.
 *
 * Single live read: the most recent `VoteCast(address[],uint256[])`
 * event from the optimizer (`useLastVote`), cross-referenced with
 * `useGaugeData` for human-readable gauge name + APY at read time.
 *
 * Editorial-noir composition borrowed from Bloomberg/FT terminals:
 * mono-numerals on dark, slim 1px dividers, minimal chrome. The header
 * does the storytelling (Fraunces italic verb), the body does the
 * proving (raw on-chain data with explorer links).
 *
 * Replaces JudgeQuotes — quotes are soft signals (we asked someone to
 * say nice things), tx hashes are hard signals (the contract did the
 * thing). When you can show, don't tell.
 */

export function ProofLedger() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <ProofLedgerSkeleton />;
  }
  return <ProofLedgerInner />;
}

function ProofLedgerInner() {
  const { vote, isLoading, isError } = useLastVote();
  const { gauges } = useGaugeData();

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
      <Header isError={isError} />

      <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-card/30 backdrop-blur">
        {/* Card head — receipt label + status chip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/40 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Receipt aria-hidden className="h-4 w-4 text-mezo" />
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Last keeper transaction
            </p>
          </div>
          <StatusChip
            label={isError ? "rpc err" : isLoading ? "syncing…" : "live"}
            tone={isError ? "warning" : "live"}
          />
        </div>

        {isLoading ? (
          <LedgerBodySkeleton />
        ) : !vote ? (
          <LedgerEmpty />
        ) : (
          <LedgerBody vote={vote} gauges={gauges ?? []} />
        )}
      </div>

      {/* Anchor links — optimizer + explorer entry points */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <ExplorerLink href={`${MEZO_EXPLORER}/address/${OPTIMIZER_ADDRESS}`}>
          Optimizer · {OPTIMIZER_ADDRESS.slice(0, 8)}…{OPTIMIZER_ADDRESS.slice(-4)}
        </ExplorerLink>
        <span className="hidden h-3 w-px bg-border sm:inline-block" />
        <ExplorerLink href={`${MEZO_EXPLORER}/address/${OPTIMIZER_ADDRESS}#events`}>
          All VoteCast events
        </ExplorerLink>
      </div>
    </section>
  );
}

function Header({ isError }: { isError: boolean }) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mezo">
        {isError ? "Proof of execution · degraded" : "Proof of execution"}
      </p>
      <h2 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-5xl">
        The keeper{" "}
        <span className="italic text-mezo">voted.</span>
        <br />
        Receipts, not promises.
      </h2>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
        Every other section on this page is a claim. This one is a transaction
        hash. The keeper bot signs and submits{" "}
        <span className="text-foreground">
          <code className="font-mono text-[0.92em]">castOptimalVote()</code>
        </span>{" "}
        to the optimizer at every weekly epoch boundary — here is the most
        recent receipt, pulled live from the chain.
      </p>
    </div>
  );
}

function LedgerBody({
  vote,
  gauges,
}: {
  vote: NonNullable<ReturnType<typeof useLastVote>["vote"]>;
  gauges: Gauge[];
}) {
  const top = pickTopGauge(vote.gauges, vote.weights, gauges);
  const moreCount = vote.gauges.length - 1;
  const ageLabel = formatRelative(vote.blockTimestamp);

  return (
    <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
      {/* Tx hash — primary cell, larger */}
      <div className="bg-card/20 p-6 sm:col-span-2 sm:p-8">
        <FieldLabel>Transaction</FieldLabel>
        <a
          href={`${MEZO_EXPLORER}/tx/${vote.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-3 inline-flex items-center gap-2 font-mono text-base text-foreground transition-colors hover:text-mezo sm:text-lg"
        >
          <span className="break-all">
            {vote.txHash.slice(0, 14)}…{vote.txHash.slice(-12)}
          </span>
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mezo"
          />
        </a>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Signed by the MezoYield keeper · sent to{" "}
          <code className="text-foreground">castOptimalVote()</code>
        </p>
      </div>

      {/* Block number + age */}
      <div className="bg-card/20 p-6 sm:p-8">
        <FieldLabel>Block</FieldLabel>
        <p className="mt-3 font-mono text-2xl text-foreground sm:text-3xl">
          {Number(vote.blockNumber).toLocaleString("en-US")}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {ageLabel}
        </p>
      </div>

      {/* Gauge selected */}
      <div className="bg-card/20 p-6 sm:p-8">
        <FieldLabel>Gauge selected</FieldLabel>
        <p className="mt-3 truncate font-display text-xl font-medium tracking-tight text-foreground sm:text-2xl">
          {top.name}
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
          {top.address.slice(0, 6)}…{top.address.slice(-4)}
        </p>
      </div>

      {/* Weight */}
      <div className="bg-card/20 p-6 sm:p-8">
        <FieldLabel>Weight</FieldLabel>
        <p className="mt-3 font-mono text-2xl text-mezo sm:text-3xl">
          {(Number(top.weightBps) / 100).toFixed(1)}%
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {top.weightBps.toString()} bps{" "}
          {moreCount > 0 ? `· +${moreCount} more` : "· single-gauge"}
        </p>
      </div>

      {/* Strategy fingerprint */}
      <div className="bg-card/20 p-6 sm:p-8">
        <FieldLabel>Strategy fired</FieldLabel>
        <p className="mt-3 font-display text-xl font-medium tracking-tight text-foreground sm:text-2xl">
          Set &amp; Forget
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {top.apyPercent != null ? `~${top.apyPercent.toFixed(1)}% APY at vote time` : "APY: gauge data pending"}
        </p>
      </div>
    </div>
  );
}

function LedgerEmpty() {
  return (
    <div className="px-8 py-16 text-center">
      <p className="font-display text-2xl font-medium tracking-tight text-foreground">
        Awaiting first keeper transaction.
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        The keeper fires at every weekly epoch boundary. Check back at the
        next epoch start, or run the keeper manually from{" "}
        <code className="text-foreground">packages/keeper</code>.
      </p>
    </div>
  );
}

function LedgerBodySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
      <div className="bg-card/20 p-8 sm:col-span-2">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card/20 p-8">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-7 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ProofLedgerSkeleton() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
      <div className="max-w-3xl">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-12 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-12 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-card/30">
        <div className="border-b border-border bg-card/40 px-8 py-4">
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
        <LedgerBodySkeleton />
      </div>
    </section>
  );
}

/* ---------- subcomponents + helpers ---------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </p>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "live" | "warning";
}) {
  const dotClass = tone === "live" ? "bg-mezo" : "bg-amber-400";
  const textClass = tone === "live" ? "text-mezo" : "text-amber-400";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em]">
      <span className="relative flex h-1.5 w-1.5">
        {tone === "live" ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mezo opacity-75" />
        ) : null}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
      </span>
      <span className={textClass}>{label}</span>
      <span className="text-muted-foreground">· testnet 31611</span>
    </span>
  );
}

function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 transition-colors hover:text-mezo"
    >
      {children}
      <ExternalLink aria-hidden className="h-3 w-3" />
    </a>
  );
}

function pickTopGauge(
  voteGauges: readonly Address[],
  voteWeights: readonly bigint[],
  knownGauges: Gauge[],
): { address: Address; name: string; weightBps: bigint; apyPercent: number | null } {
  let topIdx = 0;
  for (let i = 1; i < voteWeights.length; i++) {
    if (voteWeights[i] > voteWeights[topIdx]) topIdx = i;
  }
  const address = voteGauges[topIdx] ?? ("0x0000000000000000000000000000000000000000" as Address);
  const weightBps = voteWeights[topIdx] ?? 0n;
  const meta = knownGauges.find(
    (g) => g.address.toLowerCase() === address.toLowerCase(),
  );
  return {
    address,
    name: meta?.name ?? "Unknown gauge",
    weightBps,
    apyPercent: meta?.apyPercent ?? null,
  };
}

function formatRelative(blockTimestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(blockTimestamp);
  const delta = Math.max(0, now - ts);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  const days = Math.floor(delta / 86_400);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
