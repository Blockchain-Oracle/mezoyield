"use client";

import { useEffect, useState } from "react";
import { Save, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "mezoyield:settings:v1";

type Preferences = {
  /**
   * % of claimed MUSD to auto-compound into MEZO via Tigris swap +
   * re-lock as veMEZO. 0 = never. Phase 7 will read this and route
   * the post-claim flow accordingly.
   */
  autoCompoundPct: number;
  /** Default gas-fee multiplier when submitting a vote. */
  gasFeeBoost: 100 | 110 | 125 | 150;
  /** Optional notification email — Phase 8 polish, not wired yet. */
  notificationEmail: string;
};

const DEFAULTS: Preferences = {
  autoCompoundPct: 0,
  gasFeeBoost: 100,
  notificationEmail: "",
};

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(p: Preferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function PreferencesCard() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Load on mount.
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  // Auto-clear "Saved" hint after 2s.
  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const handleSave = () => {
    savePrefs(prefs);
    setSavedAt(Date.now());
  };

  return (
    <Card className="bg-card">
      <CardContent>
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
              Preferences
            </h2>
            <p className="text-sm text-muted-foreground">
              Stored locally in your browser. Phase 7 wires the auto-compound
              setting into the claim flow; gas boost ships with the next vote
              you submit.
            </p>
          </div>

          {/* Auto-compound % slider — explainer is INLINE so the
           * control and the consequence sit visually together. When
           * the % is 0 the explainer collapses to keep the card calm;
           * any non-zero value reveals the 3-step flow + chip + the
           * Preview disclosure. */}
          <div className="space-y-3">
            <label
              htmlFor="auto-compound"
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-foreground"
            >
              <span>Auto-compound MUSD → veMEZO</span>
              <span className="font-mono text-mezo">
                {prefs.autoCompoundPct}% of each claim
              </span>
            </label>
            <input
              id="auto-compound"
              type="range"
              min={0}
              max={100}
              step={5}
              value={prefs.autoCompoundPct}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  autoCompoundPct: Number(e.target.value),
                }))
              }
              className="w-full accent-[--color-mezo]"
            />
            {prefs.autoCompoundPct === 0 ? (
              <p className="text-xs text-muted-foreground">
                Drag above 0% to route a share of each MUSD claim into
                veMEZO via Tigris. The rest still goes to your wallet.
              </p>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    What this does
                  </span>
                  <Badge className="bg-amber-500/10 text-amber-400">
                    Preview
                  </Badge>
                </div>
                <ol className="space-y-2 text-xs text-muted-foreground">
                  {[
                    <>
                      Click <span className="text-foreground">Claim</span> on the
                      Dashboard. Your pending MUSD splits into{" "}
                      <span className="text-foreground">wallet</span> and{" "}
                      <span className="text-mezo">compound</span> per the % above.
                    </>,
                    <>
                      The compound share is swapped{" "}
                      <span className="text-foreground">MUSD → MEZO</span> via the
                      Tigris router and re-locked as additional veMEZO.
                    </>,
                    <>
                      Your voting power grows without you topping up. Wallet
                      share lands in your address as usual.
                    </>,
                  ].map((body, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mezo-soft font-mono text-[10px] font-semibold text-mezo">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{body}</span>
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
                  <span className="text-amber-400">Preview note:</span> the split
                  is computed and surfaced everywhere you claim. The actual
                  swap call ships in a follow-up — manual claim today routes
                  100% to your wallet.
                </p>
              </div>
            )}
          </div>

          {/* Gas-fee boost radio */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm text-foreground">
                Gas-fee boost
              </label>
              <span className="rounded-full border border-border bg-card/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Coming next
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {([100, 110, 125, 150] as const).map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setPrefs((p) => ({ ...p, gasFeeBoost: b }))}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    prefs.gasFeeBoost === b
                      ? "border-mezo bg-mezo-soft text-mezo"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b}%
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Saved as a preference now; the multiplier wires into wagmi&rsquo;s
              <code className="mx-1 font-mono">maxFeePerGas</code> /
              <code className="ml-1 font-mono">maxPriorityFeePerGas</code> in a
              follow-up commit. Same pattern as the notification email below.
            </p>
          </div>

          {/* Notification email */}
          <div className="space-y-2">
            <label
              htmlFor="notif-email"
              className="block text-sm text-foreground"
            >
              Notification email <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="notif-email"
              type="email"
              placeholder="you@example.com"
              value={prefs.notificationEmail}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, notificationEmail: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-card/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-mezo focus:outline-none"
            />
            <p className="text-xs text-muted-foreground">
              When the keeper bot fires your weekly vote, we&rsquo;ll send a
              summary of the new allocation. (Notification delivery ships in a
              follow-up commit.)
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">
              {savedAt
                ? "Saved to local storage."
                : "Changes are not persisted until you save."}
            </p>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-mezo text-primary-foreground hover:bg-mezo-hover"
            >
              <Save aria-hidden className="mr-1.5 h-4 w-4" />
              Save preferences
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
