"use client";

import { PageHeader } from "@/components/chrome/PageHeader";
import { AutoCompoundCard } from "@/features/settings/AutoCompoundCard";
import { GasFeeCard } from "@/features/settings/GasFeeCard";
import { NotificationsCard } from "@/features/settings/NotificationsCard";
import { usePreferences } from "@/features/settings/usePreferences";

export default function SettingsPage() {
  const { prefs, setPrefs, save, dirty, justSaved } = usePreferences();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Your MezoYield preferences"
        description="Auto-compound %, gas-fee boost, optional notifications. Stored in your browser; nothing leaves the client."
      />
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
