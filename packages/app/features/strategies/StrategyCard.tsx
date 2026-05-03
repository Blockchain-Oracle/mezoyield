"use client";

import { Sparkles } from "lucide-react";
import { formatUnits } from "viem";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  estimateWeeklyMusdWei,
  TOTAL_BPS,
} from "@/lib/optimize";
import type { Gauge } from "@/lib/types";
import {
  type StrategyPreset,
  CUSTOM_ID,
  SET_AND_FORGET_ID,
  autoAllocate,
} from "./presets";

/**
 * One card per strategy on the Strategies grid. Shows: name + tagline,
 * risk badge, projected MUSD/week (computed from a 1000 veMEZO baseline
 * so users have something to compare across strategies even before
 * connecting), description, primary CTA.
 */

const RISK_BADGE: Record<
  StrategyPreset["riskTone"],
  { className: string }
> = {
  low: { className: "bg-emerald-500/10 text-emerald-400" },
  medium: { className: "bg-amber-500/10 text-amber-400" },
  high: { className: "bg-red-500/10 text-red-400" },
  neutral: { className: "bg-white/10 text-white/70" },
};

const BASELINE_VEMEZO_WEI = 1000n * 10n ** 18n;

interface StrategyCardProps {
  preset: StrategyPreset;
  gauges: Gauge[];
  onActivate: (preset: StrategyPreset) => void;
}

export function StrategyCard({
  preset,
  gauges,
  onActivate,
}: StrategyCardProps) {
  const allocation =
    preset.execution.mode === "manual"
      ? preset.execution.allocation(gauges)
      : preset.execution.mode === "delegate"
        ? autoAllocate(gauges)
        : [];

  const weeklyWei = estimateWeeklyMusdWei(
    BASELINE_VEMEZO_WEI,
    allocation,
    gauges,
  );
  const weeklyMusd = Number(formatUnits(weeklyWei, 18));

  const isFeatured = preset.id === SET_AND_FORGET_ID;
  const isCustom = preset.id === CUSTOM_ID;

  return (
    <Card
      className={cn(
        "h-full bg-card transition-shadow hover:shadow-lg",
        isFeatured && "ring-2 ring-mezo",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-foreground">
            {preset.name}
          </CardTitle>
          <Badge className={RISK_BADGE[preset.riskTone].className}>
            {preset.riskLabel}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {preset.tagline}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {!isCustom && (
          <div className="flex items-baseline justify-between rounded-lg bg-background/40 px-3 py-2.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Projected
            </span>
            <span className="font-mono text-base text-foreground">
              {gauges.length === 0 ? (
                <span className="text-muted-foreground">— MUSD/wk</span>
              ) : (
                <>
                  ≈ {weeklyMusd.toFixed(2)}{" "}
                  <span className="text-xs text-muted-foreground">
                    MUSD/wk · 1k veMEZO
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        <p className="text-sm text-muted-foreground">{preset.description}</p>

        {isFeatured && (
          <div className="flex items-center gap-2 rounded-md border border-mezo/20 bg-mezo-soft px-3 py-2">
            <Sparkles aria-hidden className="h-4 w-4 text-mezo" />
            <span className="text-xs text-mezo">
              Recommended — automated rebalancing
            </span>
          </div>
        )}

        {!isCustom && allocation.length > 0 && (
          <div className="space-y-1.5">
            {allocation.map((entry) => {
              const g = gauges.find((x) => x.address === entry.gauge);
              return (
                <div
                  key={entry.gauge}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span className="truncate">{g?.name ?? "—"}</span>
                  <span className="font-mono text-foreground">
                    {((entry.weightBps / TOTAL_BPS) * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button
            type="button"
            onClick={() => onActivate(preset)}
            className={cn(
              "w-full",
              isFeatured
                ? "bg-mezo text-primary-foreground hover:bg-mezo-hover"
                : "bg-foreground text-background hover:bg-foreground/90",
            )}
            disabled={isCustom}
          >
            {isCustom ? "Coming next" : "Activate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
