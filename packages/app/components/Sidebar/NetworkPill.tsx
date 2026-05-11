import { MEZO_CHAIN_ID } from "@/lib/contracts";

/**
 * Persistent in-app shell indicator for the active Mezo chain. Renders
 * a pulsing dot + the chain label so anyone landing on /app/* never
 * loses the "what network am I on" signal that exists on the landing
 * Hero status chip.
 *
 * Pure — no wagmi hooks, reads only the deployment manifest. Safe to
 * render in both Sidebar (lg+) and MobileHeader (under lg).
 */
const NETWORK_LABEL: Record<number, string> = {
  31611: "Mezo Testnet",
  31612: "Mezo Mainnet",
};

export function NetworkPill() {
  const label = NETWORK_LABEL[MEZO_CHAIN_ID] ?? `Chain ${MEZO_CHAIN_ID}`;
  const isTestnet = MEZO_CHAIN_ID === 31611;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-foreground/10 bg-sidebar-foreground/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/70">
      <span className="relative flex h-1.5 w-1.5">
        <span
          aria-hidden
          className={`absolute inset-0 animate-ping rounded-full opacity-60 ${
            isTestnet ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            isTestnet ? "bg-amber-400" : "bg-emerald-400"
          }`}
        />
      </span>
      <span>{label}</span>
      <span className="text-sidebar-foreground/40">·</span>
      <span>{MEZO_CHAIN_ID}</span>
    </div>
  );
}
