"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Coins, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useClaimRewards } from "@/hooks/useClaimRewards";
import { ClaimButton } from "@/components/ClaimButton";
import { computeSplit, readAutoCompoundPct } from "@/lib/autoCompound";

/**
 * Wraps the existing ClaimButton with a card that names the pending
 * amount on its own line. Sits at the bottom of /app/dashboard so the
 * "you have rewards to claim" CTA stays visible without scrolling.
 *
 * When the user is disconnected we render nothing — same convention as
 * ClaimButton — so the dashboard collapses naturally for first-time
 * visitors who haven't connected yet.
 *
 * Auto-compound preview (Phase 7): when the user has set a non-zero
 * compound % on /app/settings, we surface the wallet/compound split
 * inline so they see what's about to happen before clicking Claim.
 * Preview only — actual swap ships in a follow-up (see
 * features/settings/AutoCompoundExplainer for the honest framing).
 */
export function PendingClaimCard() {
  const { address } = useAccount();
  const claim = useClaimRewards(address);
  const [compoundPct, setCompoundPct] = useState(0);

  // Read the saved % on mount AND on every storage event (the
  // settings page writes here; cross-tab updates flow through). The
  // window guard keeps SSR happy even though this component is
  // already "use client".
  useEffect(() => {
    setCompoundPct(readAutoCompoundPct());
    if (typeof window === "undefined") return;
    const onStorage = () => setCompoundPct(readAutoCompoundPct());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!address) return null;

  const pendingMusd = Number(formatUnits(claim.pendingWei, 18));
  const hasPending = claim.pendingWei > 0n;
  const split = computeSplit(claim.pendingWei, compoundPct);
  const showCompoundPreview = hasPending && compoundPct > 0;

  return (
    <Card className="bg-card">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <Coins aria-hidden className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Pending rewards
              </span>
              <span className="font-mono text-2xl font-semibold text-foreground">
                {hasPending ? `${pendingMusd.toFixed(2)} MUSD` : "0 MUSD"}
              </span>
              <span className="text-xs text-muted-foreground">
                {hasPending
                  ? "Claim to receive MUSD in your wallet"
                  : "Your claimable balance accrues each epoch"}
              </span>
            </div>
          </div>
          <ClaimButton />
        </div>

        {showCompoundPreview && (
          <div className="flex items-start gap-3 rounded-lg border border-mezo/20 bg-mezo-soft px-3 py-2.5 text-xs">
            <Repeat aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-mezo" />
            <div className="flex-1 space-y-1.5 text-mezo">
              <div className="font-medium">
                Auto-compound preview · {split.pct}% to veMEZO
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-baseline justify-between gap-1 rounded-md bg-background/40 px-2 py-1.5 text-foreground">
                  <span className="text-muted-foreground">Wallet</span>
                  <span className="font-mono">
                    {Number(formatUnits(split.walletWei, 18)).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 rounded-md bg-background/40 px-2 py-1.5 text-foreground">
                  <span className="text-muted-foreground">→ veMEZO</span>
                  <span className="font-mono">
                    {Number(formatUnits(split.compoundWei, 18)).toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-mezo/70">
                Preview — set in Settings. Actual swap ships next; manual
                claim today routes 100% to your wallet.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
