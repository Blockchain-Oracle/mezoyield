import { ConnectButton } from "@/components/ConnectButton";

/**
 * Sidebar bottom card shown when no wallet is connected. Mirrors
 * Neko's SetupCard pattern: a tight value-prop blurb above the connect
 * CTA so the disconnected sidebar isn't dead weight.
 */
export function SetupCard() {
  return (
    <div className="rounded-xl border border-sidebar-border bg-card/40 p-4">
      <p className="text-xs font-medium text-foreground">Connect to start</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Set your MEZO yield on autopilot — pick a strategy, delegate once,
        and we handle the weekly vote.
      </p>
      <div className="mt-3">
        <ConnectButton />
      </div>
    </div>
  );
}
