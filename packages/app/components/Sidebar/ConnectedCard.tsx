"use client";

import { useDisconnect } from "wagmi";
import { LogOut } from "lucide-react";
import type { Address } from "@/lib/types";

interface ConnectedCardProps {
  address: Address;
}

/**
 * Sidebar bottom card shown while a wallet is connected. Truncated
 * address + disconnect button. The disconnect uses wagmi's
 * `useDisconnect` directly (not RainbowKit's) so it works regardless
 * of which wallet adapter the user opened.
 */
export function ConnectedCard({ address }: ConnectedCardProps) {
  const { disconnect } = useDisconnect();
  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-sidebar-border bg-card/40 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Connected
        </span>
        <span className="font-mono text-xs text-foreground">{truncated}</span>
      </div>
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-mezo"
      >
        <LogOut aria-hidden className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
