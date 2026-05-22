"use client";

import { useAccount } from "wagmi";
import { Card, CardContent } from "@/components/ui/card";
import { MEZO_EXPLORER, MEZO_NETWORK, VE_MEZO_NFT_ADDRESS } from "@/lib/contracts";
import { useRealVeMezoPosition } from "@/hooks/useRealVeMezoPosition";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { formatMUSD, formatAddressLong } from "@/lib/format";

/**
 * "This is real" credibility anchor on /app/dashboard. Reads from the
 * upstream Mezo veMEZO contract directly (not the VotingPower shim or
 * a mock), surfaces per-NFT lock details, and shows wallet balances
 * for the three ecosystem tokens.
 *
 * Visible on mainnet only — testnet doesn't have real veMEZO. The
 * existing PositionSummary card covers the testnet path.
 */
export function RealChainPositionCard() {
  const { address } = useAccount();
  const real = useRealVeMezoPosition(address);
  const balances = useTokenBalances(address);

  if (!real.available) return null; // testnet — show nothing
  if (!address) {
    return (
      <Card className="bg-card">
        <CardContent className="p-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Real Mezo chain position
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Connect a wallet to read your veMEZO NFTs from the upstream Mezo contract directly.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (real.isLoading) return <Skeleton />;

  const pos = real.data;
  const nftCount = pos?.nftCount ?? 0n;
  const hasLock = nftCount > 0n;
  const unlock = pos?.earliestUnlockSeconds ?? null;
  const unlockAgo = useLiveRelativeTime(unlock);

  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Real Mezo chain position
            </div>
            <div className="mt-1 text-sm text-foreground/80">
              Read live from{" "}
              <a
                className="font-mono text-mezo hover:underline"
                href={`${MEZO_EXPLORER}/address/${VE_MEZO_NFT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
              >
                {VE_MEZO_NFT_ADDRESS ? formatAddressLong(VE_MEZO_NFT_ADDRESS) : "—"}
              </a>{" "}
              — not a mock, not a shim.
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              hasLock
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                hasLock ? "bg-success" : "bg-warning animate-pulse"
              }`}
            />
            {hasLock ? `${nftCount} veMEZO NFT${nftCount > 1n ? "s" : ""}` : "no lock yet"}
          </span>
        </header>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Metric
            label="Voting power"
            value={pos ? formatMUSD(pos.totalVotingPowerWei) : "—"}
            unit="vMEZO"
          />
          <Metric
            label="MEZO locked"
            value={pos ? formatMUSD(pos.totalLockedMezoWei) : "—"}
            unit="MEZO"
          />
        </div>

        {hasLock && pos && (
          <div className="mt-4 space-y-1 border-t border-border pt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              veMEZO NFT IDs
            </div>
            <div className="font-mono text-xs text-foreground">
              {pos.tokenIds.map((id) => `#${id.toString()}`).join("  ·  ")}
            </div>
            {unlock && (
              <div className="text-xs text-muted-foreground">
                Earliest unlock:{" "}
                <span className="font-mono text-foreground/80">
                  {new Date(Number(unlock) * 1000).toLocaleString()}
                </span>
                {unlockAgo && (
                  <span className="text-muted-foreground/70"> ({unlockAgo})</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Wallet balances
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <BalanceCell label="BTC (gas)" value={formatMUSD(balances.data.btcWei)} hint="for tx fees" />
            <BalanceCell label="MEZO" value={formatMUSD(balances.data.mezoWei)} hint="free / lockable" />
            <BalanceCell label="MUSD" value={formatMUSD(balances.data.musdWei)} hint="bribe rewards" />
          </div>
        </div>

        {MEZO_NETWORK === "mainnet" && (
          <p className="mt-4 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            All values read directly from Mezo Mainnet (chain 31612). Reads refresh every 30 s.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function BalanceCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground/70">{hint}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <div className="h-3 w-32 animate-pulse rounded bg-muted-foreground/20" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-muted-foreground/10" />
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="h-8 animate-pulse rounded bg-muted-foreground/10" />
          <div className="h-8 animate-pulse rounded bg-muted-foreground/10" />
        </div>
      </CardContent>
    </Card>
  );
}
