import { PreferencesCard } from "@/features/settings/PreferencesCard";

export default function SettingsPage() {
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
      <div className="max-w-2xl">
        <PreferencesCard />
      </div>
    </div>
  );
}
