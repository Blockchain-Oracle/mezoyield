"use client";

import { useState } from "react";
import {
  Repeat,
  Info,
  Gift,
  Save,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedBar } from "@/components/ui/segmented-bar";

/**
 * AutoCompoundCard — Boar-style card (anchor: mezo-2.png).
 *
 * Header row: repeat icon · AUTO-COMPOUND title · LIVE pill (left) and
 * big metric "{pct}% / 100%" + info icon (right). Below that a 10-segment
 * bar that doubles as the control. The 3-step compound flow lives under
 * a "Show flow" toggle so the card stays calm until the user opts in.
 *
 * Save state is owned by the parent (usePreferences). When `dirty`, the
 * card renders a primary CTA on the right of the status row; otherwise
 * a muted "Saved" hint takes its place.
 */

export interface AutoCompoundCardProps {
  pct: number;
  onChange: (next: number) => void;
  onSave: () => void;
  dirty: boolean;
  justSaved: boolean;
}

const STEPS: { body: React.ReactNode }[] = [
  {
    body: (
      <>
        Click <span className="text-foreground">Claim</span> on the Dashboard.
        Your pending MUSD splits into{" "}
        <span className="text-foreground">wallet</span> and{" "}
        <span className="text-mezo">compound</span> per the % above.
      </>
    ),
  },
  {
    body: (
      <>
        The compound share is swapped{" "}
        <span className="text-foreground">MUSD &rarr; MEZO</span> via the
        Tigris router and re-locked as additional veMEZO.
      </>
    ),
  },
  {
    body: (
      <>
        Your voting power grows without you topping up. Wallet share lands
        in your address as usual.
      </>
    ),
  },
];

export function AutoCompoundCard({
  pct,
  onChange,
  onSave,
  dirty,
  justSaved,
}: AutoCompoundCardProps) {
  const [flowOpen, setFlowOpen] = useState(false);
  const filledSegments = Math.max(0, Math.min(10, Math.floor(pct / 10)));

  const statusLine =
    pct === 0
      ? "Off — every MUSD claim lands in your wallet."
      : `Compounding ${pct}% of each claim · destination: veMEZO via Tigris`;

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-mezo-soft text-mezo"
              >
                <Repeat className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
                  AUTO-COMPOUND
                </h2>
                <span className="rounded-md bg-mezo-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mezo">
                  LIVE
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl font-medium leading-none text-foreground">
                {pct}
                <span className="text-muted-foreground">%</span>
                <span className="ml-1 font-mono text-sm text-muted-foreground">
                  / 100%
                </span>
              </span>
              <button
                type="button"
                aria-label="What does auto-compound do?"
                title="The % of each MUSD claim that auto-routes back into veMEZO via Tigris."
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Segmented bar — IS the control. Clicking segment N sets pct to N*10. */}
          <SegmentedBar
            value={filledSegments}
            max={10}
            variant="mezo"
            size="md"
            ariaLabel="Auto-compound percentage"
            onSelect={(idx) => onChange(idx * 10)}
            segmentLabel={(idx) => `Set auto-compound to ${idx * 10}%`}
          />

          {/* Status row + Save CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gift aria-hidden className="h-4 w-4 text-foreground/50" />
              <span>{statusLine}</span>
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

          {/* Show flow toggle */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setFlowOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
              aria-expanded={flowOpen}
            >
              <span className="font-mono uppercase tracking-[0.18em]">
                {flowOpen ? "Hide flow" : "Show flow"}
              </span>
              {flowOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {flowOpen ? (
              <div className="mt-3 space-y-3 rounded-lg border border-border bg-background/40 p-3">
                <ol className="space-y-2 text-xs text-muted-foreground">
                  {STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mezo-soft font-mono text-[10px] font-semibold text-mezo">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words">
                        {step.body}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <span>Pending MUSD</span>
                  <ArrowRight aria-hidden className="h-3 w-3" />
                  <span className="text-foreground">Wallet</span>
                  <span>+</span>
                  <span className="text-mezo">Compound</span>
                  <ArrowRight aria-hidden className="h-3 w-3" />
                  <span className="text-foreground">veMEZO</span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em]">
                    Tigris router
                  </span>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  <span className="text-amber-400">Preview note:</span> the
                  split is computed everywhere you claim. The actual swap call
                  ships in a follow-up — manual claim today routes 100% to
                  your wallet.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
