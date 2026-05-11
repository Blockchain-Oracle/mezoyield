"use client";

import { AutoCompoundCard } from "@/features/settings/AutoCompoundCard";
import { GasFeeCard } from "@/features/settings/GasFeeCard";
import { NotificationsCard } from "@/features/settings/NotificationsCard";
import { usePreferences } from "@/features/settings/usePreferences";

export default function SettingsPage() {
  const { prefs, setPrefs, save, dirty, justSaved } = usePreferences();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-mezo">
          Settings
        </p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-foreground">
          Your MezoYield preferences
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Auto-compound %, gas-fee boost, optional notifications. Stored in
          your browser; nothing leaves the client.
        </p>
      </header>
      <div className="flex max-w-3xl flex-col gap-4">
        <AutoCompoundCard
          pct={prefs.autoCompoundPct}
          onChange={(next) =>
            setPrefs((p) => ({ ...p, autoCompoundPct: next }))
          }
          onSave={save}
          dirty={dirty}
          justSaved={justSaved}
        />
        <GasFeeCard
          boost={prefs.gasFeeBoost}
          onChange={(next) => setPrefs((p) => ({ ...p, gasFeeBoost: next }))}
          onSave={save}
          dirty={dirty}
          justSaved={justSaved}
        />
        <NotificationsCard
          email={prefs.notificationEmail}
          onChange={(next) =>
            setPrefs((p) => ({ ...p, notificationEmail: next }))
          }
          onSave={save}
          dirty={dirty}
          justSaved={justSaved}
        />
      </div>
    </div>
  );
}
