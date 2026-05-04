"use client";

import { ArrowRight, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Sits next to PreferencesCard on /app/settings. Explains exactly
 * what the auto-compound % preference does end-to-end so users
 * understand what they're enabling.
 *
 * Honesty marker — Phase 7 ships the PREVIEW (the split is computed
 * and surfaced in the claim card / success toast). The actual swap
 * via Tigris ships in a follow-up because a safe atomic
 * claimAndCompound requires a contract upgrade we're not landing
 * inside the V2 window.
 */
export function AutoCompoundExplainer() {
  return (
    <Card className="overflow-hidden bg-card">
      <CardContent>
        {/* Header sits ABOVE the icon column on mobile (sm-) so we don't
         * burn ~52px of horizontal real estate on a 390px viewport.
         * On sm+ we flip to the side-by-side icon-then-content layout
         * the rest of the cards use. min-w-0 + break-words on the text
         * column keeps long lines from forcing parent overflow. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mezo-soft">
            <Repeat aria-hidden className="h-5 w-5 text-mezo" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-2xl font-medium tracking-tight text-foreground">
                Auto-compound — how it works
              </h3>
              <Badge className="bg-amber-500/10 text-amber-400">
                Preview
              </Badge>
            </div>

            <ol className="space-y-3 text-sm text-muted-foreground">
              {[
                <>
                  You set <span className="text-foreground">Auto-compound %</span> on the
                  left. Stored locally; nothing leaves your browser until you
                  claim.
                </>,
                <>
                  When you click <span className="text-foreground">Claim</span> on the
                  Dashboard, the pending MUSD splits into{" "}
                  <span className="text-foreground">wallet</span> /{" "}
                  <span className="text-foreground">compound</span> per your %.
                </>,
                <>
                  The compound share is swapped{" "}
                  <span className="text-foreground">MUSD → MEZO</span> via the Tigris
                  router and re-locked as additional veMEZO, growing your
                  voting power without you topping up.
                </>,
              ].map((body, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mezo-soft font-mono text-[11px] font-semibold text-mezo">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{body}</span>
                </li>
              ))}
            </ol>

            {/* Flow chip — wraps onto two rows under sm (label moves
             * below the trail). Each token is gap-y-friendly so the
             * arrows don't collide with line wraps on narrow screens. */}
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                <span>Pending MUSD</span>
                <ArrowRight aria-hidden className="h-3 w-3" />
                <span className="text-foreground">Wallet</span>
                <span>+</span>
                <span className="text-mezo">Compound</span>
                <ArrowRight aria-hidden className="h-3 w-3" />
                <span className="text-foreground">veMEZO</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Tigris router
              </span>
            </div>

            <p className="break-words text-[11px] text-muted-foreground">
              <span className="text-amber-400">Preview note:</span> the split is
              computed and surfaced everywhere you claim. The actual MUSD →
              MEZO swap call ships in a follow-up — safe auto-compound requires
              an atomic <code className="break-all">claimAndCompound</code> on
              the optimizer, which is a contract upgrade outside the V2
              window. Manual claim today; auto next.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
