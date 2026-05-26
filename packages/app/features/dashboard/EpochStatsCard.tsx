"use client";

import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useEpochCountdown } from "@/hooks/useEpochCountdown";
import { useLastVote } from "@/hooks/useLastVote";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { useProtocolStrategyMix } from "@/hooks/useProtocolStrategyMix";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";

const SEVEN_DAYS_SECONDS = 7n * 86_400n;

/**
 * Aggregate epoch + protocol stats card — mirrors Mezo's right-side
 * "Total stats across votes" panel. Combines four reads into one
 * scannable surface so the user sees the system's pulse at a glance:
 *
 *   - Epoch label + progress bar (from useEpochCountdown)
 *   - Total veMEZO under the optimizer (from useProtocolStrategyMix)
 *   - Last keeper vote relative time (from useLastVote + useLiveRelativeTime)
 *   - User's own veMEZO voting power (from useVeMezoPosition)
 *
 * Subsumes the role of EpochCountdownStrip — dashboard renders this
 * instead, so countdown + keeper heartbeat live in one card alongside
 * the protocol-wide numbers.
 */
export function EpochStatsCard() {
  const { label, progress } = useEpochCountdown();
  const { vote, isLoading: voteLoading } = useLastVote();
  const ago = useLiveRelativeTime(vote?.blockTimestamp);
  const { totalVeMezoWei, isLoading: mixLoading } = useProtocolStrategyMix();
  const { address } = useAccount();
  const { balanceWei: userVeMezoWei } = useVeMezoPosition(address);

  const pct = Math.round(progress * 100);
  const isStale =
    vote && Date.now() / 1000 - Number(vote.blockTimestamp) > Number(SEVEN_DAYS_SECONDS);

  return (
    <aside
      aria-label="Epoch stats"
      className="rounded-xl border border-border bg-card p-5 space-y-5"
    >
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Epoch stats
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Live across the optimizer
        </p>
      </header>

      <section>
        <Row label="Epoch ends in" value={label.replace(" until next epoch", "")} />
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div
            aria-hidden
            className="h-full rounded-full bg-mezo transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
          {pct}% through this week
        </p>
      </section>

      <div className="space-y-3 border-t border-border pt-4">
        <Row
          label="Total veMEZO managed"
          value={
            mixLoading
              ? "—"
              : formatVeMezo(totalVeMezoWei)
          }
        />
        <Row
          label="Your voting power"
          value={address ? formatVeMezo(userVeMezoWei) : "—"}
        />
        <Row
          label="Last keeper vote"
          value={
            voteLoading && !vote
              ? "Checking…"
              : ago
                ? ago
                : "No votes yet"
          }
          tone={isStale ? "warning" : undefined}
        />
      </div>
    </aside>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={
          "font-mono text-sm " +
          (tone === "warning" ? "text-warning" : "text-foreground")
        }
      >
        {value}
      </span>
    </div>
  );
}

function formatVeMezo(wei: bigint): string {
  const n = Number(formatUnits(wei, 18));
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(2);
}
