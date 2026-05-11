"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { CARD_STYLES, CARD_BUTTON_STYLES } from "./sidebarConfig";

/**
 * Adapted from Neko's `SetupCard.tsx` — same gray card + black pill
 * button. Stellar's `useStellarWallet().connect` is replaced with
 * RainbowKit's `useConnectModal().openConnectModal` since we're EVM.
 */
export function SetupCard() {
  const { openConnectModal } = useConnectModal();

  return (
    <div className={CARD_STYLES}>
      <p className="mb-6 text-base font-bold leading-snug text-card-foreground">
        Connect your wallet
        <br />
        to get started!
      </p>
      <button
        type="button"
        onClick={() => openConnectModal?.()}
        className={CARD_BUTTON_STYLES}
      >
        Connect Account
        <ArrowRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  );
}
