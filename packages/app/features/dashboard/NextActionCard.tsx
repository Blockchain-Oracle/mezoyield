"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowRight, Sparkles, Vote, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useIsDelegated } from "@/hooks/useIsDelegated";

/**
 * Context-aware "what should I do next" card. Reads the user's state
 * (connected? delegated? has allocation?) and surfaces the single most
 * useful next action.
 *
 * State machine
 *   - Disconnected            → "Connect wallet to start"
 *   - Connected, no delegation, no allocation → "Pick a strategy → /app/strategies"
 *   - Connected, delegated    → "Set & Forget active. Keeper votes at every weekly epoch boundary."
 *   - Connected, has allocation (manual) → "X gauges allocated. Switch any time."
 */
export function NextActionCard() {
  const { address, isConnected } = useAccount();
  const position = useVeMezoPosition(address);
  const { isDelegated } = useIsDelegated(address);

  let icon = <Vote aria-hidden className="h-5 w-5 text-mezo" />;
  let label = "Next step";
  let title = "Pick a strategy";
  let description = "Browse 6 yield strategies and activate one.";
  let cta: { href: string; text: string } | null = {
    href: "/app/strategies",
    text: "Browse strategies",
  };

  if (!isConnected) {
    icon = <Wallet aria-hidden className="h-5 w-5 text-mezo" />;
    title = "Connect to start earning MUSD";
    description =
      "Connect a wallet to see your veMEZO position, pick a strategy, and start earning MUSD.";
    cta = null;
  } else if (isDelegated) {
    icon = <Sparkles aria-hidden className="h-5 w-5 text-mezo" />;
    label = "Active";
    title = "Set & Forget is active";
    description =
      "MezoYield's keeper votes for the highest-APY gauge for you at every weekly epoch boundary. You can claim rewards any time below.";
    cta = { href: "/app/strategies", text: "Switch strategy" };
  } else if (position.allocation.length > 0) {
    icon = <Vote aria-hidden className="h-5 w-5 text-mezo" />;
    label = "Active";
    title = `${position.allocation.length} gauge${position.allocation.length > 1 ? "s" : ""} allocated`;
    description =
      "Your manual allocation is live. Re-activate a strategy any time to change it.";
    cta = { href: "/app/strategies", text: "Switch strategy" };
  }

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mezo-soft">
            {icon}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="text-base font-semibold text-foreground">
              {title}
            </span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </div>
          {cta && (
            <Link
              href={cta.href}
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-mezo px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-mezo-hover"
            >
              {cta.text} <ArrowRight aria-hidden className="ml-1 h-4 w-4" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
