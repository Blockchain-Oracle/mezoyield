"use client";

import { AlertTriangle } from "lucide-react";
import { useEnsureMezoChain } from "@/hooks/useEnsureMezoChain";
import { MEZO_CHAIN_ID } from "@/lib/contracts";

/**
 * Persistent banner that appears when a connected wallet is on the
 * wrong chain. The hook auto-fires `switchChain` once on connect-with-
 * mismatch; this banner is the visible "still wrong" surface for cases
 * where the user dismissed/rejected the wallet prompt, and provides a
 * "Retry switch" button that re-fires the prompt.
 *
 * Returns `null` (no DOM) when the wallet is disconnected or already
 * on Mezo, so we don't push the rest of the layout down by 40px in the
 * happy path.
 */
const NETWORK_LABEL: Record<number, string> = {
  31611: "Mezo Testnet",
  31612: "Mezo Mainnet",
};

export function ChainMismatchBanner() {
  const { isMismatched, isSwitching, error, ensureMezo } = useEnsureMezoChain();
  if (!isMismatched) return null;

  const label = NETWORK_LABEL[MEZO_CHAIN_ID] ?? `Mezo (${MEZO_CHAIN_ID})`;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
      <span>
        Wrong network — MezoYield runs on <strong>{label}</strong>.
      </span>
      <button
        type="button"
        onClick={ensureMezo}
        disabled={isSwitching}
        className="rounded-md border border-amber-500/50 bg-amber-500/20 px-2.5 py-0.5 font-medium transition-colors hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSwitching ? "Switching…" : `Switch to ${label}`}
      </button>
      {error && (
        <span className="text-xs text-amber-700 dark:text-amber-300">
          ({error.message.length > 60
            ? error.message.slice(0, 60) + "…"
            : error.message})
        </span>
      )}
    </div>
  );
}
