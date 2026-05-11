"use client";

import { Fuel, Info, Save } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import type { GasFeeBoost } from "@/features/settings/usePreferences";

/**
 * GasFeeCard — Boar-style card. Title GAS-FEE BOOST + COMING NEXT
 * amber pill (the wagmi maxFeePerGas wiring lands later; we save the
 * preference now). 4-segment SegmentedBar shows the active preset
 * position; preset buttons under the bar give the precise selection
 * for users who want labels over visual position.
 */

const PRESETS: GasFeeBoost[] = [100, 110, 125, 150];

export interface GasFeeCardProps {
  boost: GasFeeBoost;
  onChange: (next: GasFeeBoost) => void;
  onSave: () => void;
  dirty: boolean;
  justSaved: boolean;
}

function boostToSegment(boost: GasFeeBoost): number {
  const idx = PRESETS.indexOf(boost);
  return idx === -1 ? 1 : idx + 1;
}

export function GasFeeCard({
  boost,
  onChange,
  onSave,
  dirty,
  justSaved,
}: GasFeeCardProps) {
  const filled = boostToSegment(boost);

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400"
              >
                <Fuel className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                  GAS-FEE BOOST
                </h2>
                <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                  COMING NEXT
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl font-medium leading-none text-foreground">
                {boost}
                <span className="text-muted-foreground">%</span>
              </span>
              <button
                type="button"
                aria-label="What does gas-fee boost do?"
                title="Multiplier applied to wagmi's fee estimation when submitting a vote."
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Segmented bar — 4 segments, click sets the preset. */}
          <SegmentedBar
            value={filled}
            max={4}
            variant="mezo"
            size="md"
            ariaLabel="Gas-fee boost preset"
            onSelect={(idx) => onChange(PRESETS[idx - 1])}
            segmentLabel={(idx) => `Set gas-fee boost to ${PRESETS[idx - 1]}%`}
          />

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() => onChange(b)}
                className={
                  boost === b
                    ? "rounded-md border border-mezo bg-mezo-soft px-3 py-1.5 text-sm text-mezo transition-colors"
                    : "rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {b}%
              </button>
            ))}
          </div>

          {/* Status row */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Saved now; wires into wagmi&rsquo;s{" "}
              <code className="font-mono">maxFeePerGas</code> in a follow-up.
            </p>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button
                  type="button"
                  onClick={onSave}
                  className="bg-mezo text-primary-foreground hover:bg-mezo-hover"
                >
                  <Save aria-hidden className="mr-1.5 h-4 w-4" />
                  Save preferences
                </Button>
              ) : justSaved ? (
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-foreground/60">
                  Saved
                </span>
              ) : (
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  No changes
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
