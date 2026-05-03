"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

          {/* Auto-compound % slider */}
          <div className="space-y-2">
            <label
              htmlFor="auto-compound"
              className="flex items-baseline justify-between text-sm text-foreground"
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
            <p className="text-xs text-muted-foreground">
              When you claim MUSD, this share is swapped to MEZO via Tigris and
              locked as additional veMEZO. The rest goes to your wallet.
            </p>
          </div>

          {/* Gas-fee boost radio */}
          <div className="space-y-2">
            <label className="block text-sm text-foreground">
              Gas-fee boost
            </label>
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
              Multiplier applied to viem&rsquo;s default fee suggestion. 100% =
              estimated; 150% = aggressive (pays more to land faster).
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
