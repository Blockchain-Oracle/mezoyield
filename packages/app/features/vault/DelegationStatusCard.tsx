"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowRight, Sparkles, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useIsDelegated } from "@/hooks/useIsDelegated";

/**
 * Vault status card. Shows whether the user is delegated to MezoYield
 * (Set & Forget active), and links them to /app/strategies if not.
 *
 * Three states:
 *   - Disconnected: prompt to connect (matches Dashboard's NextActionCard).
 *   - Connected, not delegated: pitch Set & Forget with the activate CTA.
 *   - Connected, delegated: green status with the keeper-cadence note.
 */
export function DelegationStatusCard() {
  const { address, isConnected } = useAccount();
  const { isDelegated, isLoading } = useIsDelegated(address);

  if (!isConnected) {
    return (
      <Card className="bg-card">
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mezo-soft">
              <Wallet aria-hidden className="h-5 w-5 text-mezo" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Delegation status
              </span>
              <span className="text-base font-semibold text-foreground">
                Not connected
              </span>
              <span className="text-sm text-muted-foreground">
                Connect a wallet to view your vault and delegation status.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isDelegated ? "bg-emerald-500/10" : "bg-mezo-soft"
            }`}
          >
            {isDelegated ? (
              <ShieldCheck aria-hidden className="h-5 w-5 text-emerald-400" />
            ) : (
              <Sparkles aria-hidden className="h-5 w-5 text-mezo" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Delegation status
            </span>
            <span className="text-base font-semibold text-foreground">
              {isLoading
                ? "Checking…"
                : isDelegated
                  ? "Delegated to MezoYield"
                  : "Not delegated"}
            </span>
            <span className="text-sm text-muted-foreground">
              {isDelegated
                ? "MezoYield's keeper votes for the highest-APY gauge for you at every Mezo epoch boundary (~7 days)."
                : "Activate Set & Forget on the Strategies tab to delegate voting power and have the keeper handle weekly rebalancing."}
            </span>
          </div>
          {!isDelegated && (
            <Link
              href="/app/strategies"
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-mezo px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-mezo-hover"
            >
              Activate <ArrowRight aria-hidden className="ml-1 h-4 w-4" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
