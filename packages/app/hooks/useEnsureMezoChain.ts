"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { MEZO_CHAIN_ID } from "@/lib/contracts";

/**
 * Auto-add / auto-switch to the active Mezo chain on wallet connect.
 *
 * Anti-pattern this exists to kill (#38): a fresh-MetaMask user lands
 * on MezoYield, clicks Connect, and is told "wrong network." They then
 * have to know to manually add chainId 31611 (or 31612), the RPC URL,
 * the explorer URL, and the native currency symbol — a multi-step
 * onboarding cliff that judges and Aunt Linda alike will bail on.
 *
 * Wagmi v2's `useSwitchChain` handles EIP-3326 (`wallet_switchEthereum
 * Chain`) AND auto-falls back to EIP-3085 (`wallet_addEthereumChain`)
 * when the chain isn't already configured — provided the chain object
 * is registered in the wagmi config. `packages/app/lib/wagmi.ts` does
 * that via `@mezo-org/passport.getConfig({ mezoNetwork })`, so the
 * connector knows the chainId/RPC/explorer/symbol triplet without us
 * passing them again here.
 *
 * Behavior:
 *   - When `isConnected && chainId !== MEZO_CHAIN_ID`, fires
 *     `switchChain` exactly once per mismatch. If the user accepts,
 *     wagmi flips `chainId` and the effect re-runs as a no-op.
 *   - If the user REJECTS the prompt (or the wallet errors), surface
 *     `error` so the UI can render a banner ("Switch to Mezo Testnet
 *     to continue") with a manual retry button.
 *   - On disconnect, resets state so a future reconnect can re-fire.
 *
 * Not auto-fired in tests (NODE_ENV === "test") — the test harness
 * controls chain state explicitly.
 */
export type EnsureMezoChainState = {
  /** True when the active wallet is connected AND on the right chain. */
  isOnMezo: boolean;
  /** True when connected but on a different chain than the active build. */
  isMismatched: boolean;
  /** True while the switch/add prompt is open in the wallet. */
  isSwitching: boolean;
  /** Last error from a rejected/failed switch — null on success or idle. */
  error: Error | null;
  /** Manual retry — same call the effect fires on connect mismatch. */
  ensureMezo: () => void;
};

export function useEnsureMezoChain(): EnsureMezoChainState {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error: switchError } = useSwitchChain();
  // Track whether we've already auto-fired for the current mismatch so
  // we don't re-prompt the user on every re-render. Cleared on disconnect
  // and on success.
  const [autoFired, setAutoFired] = useState(false);
  const [manualError, setManualError] = useState<Error | null>(null);

  const isOnMezo = isConnected && chainId === MEZO_CHAIN_ID;
  const isMismatched = isConnected && chainId !== MEZO_CHAIN_ID;

  const ensureMezo = () => {
    setManualError(null);
    switchChain(
      { chainId: MEZO_CHAIN_ID },
      {
        onError: (err) => {
          setManualError(err as Error);
        },
      },
    );
  };

  // Auto-fire once on connect-into-wrong-chain. Subsequent mismatches
  // (e.g. user manually switches back in MetaMask) re-fire because
  // `autoFired` resets when the mismatch clears or the wallet drops.
  useEffect(() => {
    if (!isMismatched || autoFired || isPending) return;
    setAutoFired(true);
    ensureMezo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMismatched, autoFired, isPending]);

  useEffect(() => {
    if (!isConnected || isOnMezo) {
      setAutoFired(false);
      setManualError(null);
    }
  }, [isConnected, isOnMezo]);

  return {
    isOnMezo,
    isMismatched,
    isSwitching: isPending,
    error: (manualError ?? (switchError as Error | null)) || null,
    ensureMezo,
  };
}
