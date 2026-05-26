"use client";

import React from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { formatAddressShort } from "@/lib/format";
import { CARD_STYLES, CARD_BUTTON_STYLES } from "./sidebarConfig";
import { MEZO_CHAIN_ID } from "@/lib/contracts";

/**
 * Adapted from Neko's `ConnectedCard.tsx` — same gray card + black
 * pill button + expanding details panel + Feedback CTA at the bottom.
 *
 * Differences from Neko:
 *   - Stellar TESTNET env check replaced with chainId comparison
 *     against our deployed contracts (31611 = testnet, 31612 = mainnet).
 *   - Feedback button color: Neko's blue (#229EDF) → Mezo (#FF004D).
 */

const IS_TESTNET = MEZO_CHAIN_ID === 31611;

interface ConnectedCardProps {
  address: string;
  onDisconnect: () => void;
}

export function ConnectedCard({ address, onDisconnect }: ConnectedCardProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={CARD_STYLES}>
      <p className="mb-4 text-base font-bold leading-snug text-card-foreground">
        You&apos;re
        <br />
        connected with:
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={CARD_BUTTON_STYLES}
      >
        <span className="truncate">{formatAddressShort(address)}</span>
        <ArrowRight
          className={`ml-2 h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="flex flex-col gap-2 rounded-2xl bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${IS_TESTNET ? "bg-yellow-400" : "bg-green-400"}`}
            />
            <span className="text-xs font-semibold text-muted-foreground">
              {IS_TESTNET ? "Testnet" : "Mainnet"}
            </span>
          </div>

          <button
            type="button"
            onClick={onDisconnect}
            className="flex items-center gap-2 text-sm font-semibold text-destructive hover:opacity-80 transition-opacity cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={() =>
            window.open(
              "https://github.com/Blockchain-Oracle/mezoyield/issues/new",
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="flex w-full items-center justify-between rounded-full bg-mezo px-5 py-3 text-sm font-semibold text-primary-foreground cursor-pointer transition-colors hover:bg-mezo-hover"
        >
          <span>Feedback</span>
          <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}
