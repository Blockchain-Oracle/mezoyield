"use client";

import { useEffect, useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import {
  OPTIMIZER_ADDRESS,
  GAUGE_CONTROLLER_ADDRESS,
  VE_MEZO_ADDRESS,
  VE_MEZO_NFT_ADDRESS,
  MEZO_CHAIN_ID,
  MEZO_NETWORK,
} from "@/lib/contracts";
import { optimizerAbi, veMezoAbi, veMezoNftAbi } from "@/lib/abi";
import type { Address } from "@/lib/types";
import type { Gauge } from "@/lib/types";
import {
  type StrategyPreset,
  type AllocationEntry,
} from "./presets";

/**
 * Activate a strategy preset on the optimizer.
 *
 * The activation flow ensures every prerequisite is met BEFORE the
 * user-visible "you're now active" message lands, so users never end
 * up in silent-broken states (Abu's UX audit, 2026-05-20):
 *
 *   1. Issue #33: if the user has 0 veMEZO on testnet, call the
 *      `MockVeMezo.faucet()` so they end up with 1000 veMEZO. Without
 *      this their projected reward stays at 0 even after a successful
 *      "activation" — silently meaningless.
 *
 *   2. Issue #39: if the user isn't already delegated, submit
 *      `delegate(user)` before the strategy-specific tx. Without this,
 *      manual-mode users can `setManualAllocation` "successfully" but
 *      the keeper iterates only `isDelegated[user]` and skips them at
 *      vote time — silently broken.
 *
 *   3. Issue #32: if the user IS already delegated, skip the delegate
 *      tx (a no-op on-chain but a redundant MetaMask prompt).
 *
 *   4. Finally: submit the strategy-specific tx (delegate for set-and-
 *      forget — which is also step 2 for that mode, so we collapse;
 *      setManualAllocation for manual mode).
 *
 * Each step's tx hash is awaited before the next is submitted so the
 * user sees them sequentially in the wallet UI. `currentStep` is
 * exposed so the activation modal can render "Step 1 of 3: minting
 * testnet veMEZO" etc.
 */

// Activate flow uses three ABIs, all now sourced from `@/lib/abi`:
//   - `optimizerAbi`     — delegate + setManualAllocation + isDelegated
//   - `veMezoAbi`        — testnet mock faucet (balanceOf + faucet)
//   - `veMezoNftAbi`     — mainnet ERC-721 (isApprovedForAll, setApprovalForAll, createLock, …)
// Local copies removed during Phase D consolidation (eliminates drift
// risk between this file's ABI fragments and the canonical lib/abi.ts).

// Testnet chain id — used to gate the auto-faucet path. On mainnet the
// real veMEZO is an NFT lock with no public faucet; that branch is a
// "lock MEZO first" CTA in a follow-up PR (#33 acceptance criteria).
const MEZO_TESTNET_CHAIN_ID = 31611;

export type ActivationStep = "faucet" | "approve" | "delegate" | "vote";

export type ActivationStatus =
  | "idle"
  | "writing"
  | "confirming"
  | "success"
  | "error";

export type ActivationState = {
  status: ActivationStatus;
  txHash?: `0x${string}`;
  errorMessage?: string;
  /** True iff the connected user has previously called `delegate()`. */
  isDelegated: boolean;
  /**
   * Which precondition step the hook is currently writing — `undefined`
   * before any write fires. Lets the activation modal render context
   * like "Step 1 of 3: minting testnet veMEZO" while the user signs.
   */
  currentStep?: ActivationStep;
  /** Computed allocation for the chosen preset against current `gauges`. */
  preview: AllocationEntry[];
  activate: () => Promise<void>;
  reset: () => void;
};

interface UseActivateStrategyArgs {
  preset: StrategyPreset;
  user: Address | undefined;
  gauges: Gauge[];
}

export function useActivateStrategy({
  preset,
  user,
  gauges,
}: UseActivateStrategyArgs): ActivationState {
  const delegatedQuery = useReadContract({
    address: OPTIMIZER_ADDRESS,
    abi: optimizerAbi,
    functionName: "isDelegated",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  // veMEZO balance — drives the auto-faucet branch on testnet. Refetched
  // after a successful faucet tx so subsequent reads in the same session
  // reflect the minted 1000.
  const veMezoBalanceQuery = useReadContract({
    address: VE_MEZO_ADDRESS,
    abi: veMezoAbi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<ActivationStatus>("idle");
  const [currentStep, setCurrentStep] = useState<ActivationStep | undefined>(
    undefined,
  );

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Drive the success/error transitions off the receipt. useEffect so
  // we don't setState during render.
  useEffect(() => {
    if (phase !== "confirming") return;
    if (receipt.isSuccess) {
      setPhase("success");
      void delegatedQuery.refetch();
    } else if (receipt.isError) {
      setPhase("error");
      setErrorMessage(
        (receipt.error as Error | null)?.message ?? "Transaction reverted",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, receipt.isSuccess, receipt.isError]);

  const preview =
    preset.execution.mode === "manual"
      ? preset.execution.allocation(gauges)
      : [];

  const activate = async (): Promise<void> => {
    if (!user) return;
    setErrorMessage(undefined);
    try {
      // ─── Precondition 1 (#33): auto-faucet veMEZO on testnet ───
      // Mainnet has no faucet — that branch surfaces a "lock MEZO
      // first" CTA via the modal, not from this hook (followup PR).
      const veMezoBalance =
        (veMezoBalanceQuery.data as bigint | undefined) ?? 0n;
      const needsFaucet =
        MEZO_CHAIN_ID === MEZO_TESTNET_CHAIN_ID && veMezoBalance === 0n;
      if (needsFaucet) {
        setCurrentStep("faucet");
        setPhase("writing");
        const faucetHash = await writeContractAsync({
          address: VE_MEZO_ADDRESS,
          abi: veMezoAbi,
          functionName: "faucet",
        });
        setTxHash(faucetHash);
        // Wait for the faucet tx to confirm before submitting the next
        // step — otherwise the keeper iterates a delegated wallet whose
        // veMEZO read still returns 0 in the wallet's pending-tx view.
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: faucetHash });
        }
        await veMezoBalanceQuery.refetch();
      }

      // ─── Precondition 2 (#32/#39): ensure delegation ───
      // delegate(user) is required before the keeper notices this wallet
      // at the next epoch. Submit it for any activation mode (delegate
      // or manual) when not already delegated; short-circuit if already.
      const alreadyDelegated = !!delegatedQuery.data;
      if (!alreadyDelegated) {
        setCurrentStep("delegate");
        setPhase("writing");
        const delegateHash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerAbi,
          functionName: "delegate",
          args: [user],
        });
        setTxHash(delegateHash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: delegateHash });
        }
        await delegatedQuery.refetch();
      }

      // ─── Precondition 2.5 (mainnet only): adapter approval ───
      // The keeper's per-user fan-out calls
      // `BoostVoter.vote(tokenId, …)` AS the adapter. Solidly-style
      // BoostVoter requires `isApprovedOrOwner(msg.sender, tokenId)` —
      // so the user must grant the adapter operator-of-all on their
      // veMEZO NFT once. Without this step every keeper tick would
      // skip the user with a VoteSkipped event. Testnet's mock has no
      // approval check, so we gate this strictly on
      // `MEZO_NETWORK === "mainnet"` + `VE_MEZO_NFT_ADDRESS` being set.
      if (MEZO_NETWORK === "mainnet" && VE_MEZO_NFT_ADDRESS && publicClient) {
        const isApproved = (await publicClient.readContract({
          address: VE_MEZO_NFT_ADDRESS,
          abi: veMezoNftAbi,
          functionName: "isApprovedForAll",
          args: [user, GAUGE_CONTROLLER_ADDRESS],
        })) as boolean;
        if (!isApproved) {
          setCurrentStep("approve");
          setPhase("writing");
          const approveHash = await writeContractAsync({
            address: VE_MEZO_NFT_ADDRESS,
            abi: veMezoNftAbi,
            functionName: "setApprovalForAll",
            args: [GAUGE_CONTROLLER_ADDRESS, true],
          });
          setTxHash(approveHash);
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      // ─── Strategy-specific tx (the user-facing "activation") ───
      if (preset.execution.mode === "delegate") {
        // Set & Forget: precondition 2 IS the activation. If we got
        // here via the short-circuit (already delegated), this is the
        // no-op success path. Either way: status = success.
        setPhase("success");
        setCurrentStep(undefined);
        return;
      }
      if (preset.execution.mode === "manual") {
        const allocation = preset.execution.allocation(gauges);
        if (allocation.length === 0) {
          setPhase("error");
          setCurrentStep(undefined);
          setErrorMessage(
            "Gauge data hasn't loaded yet — wait a moment and retry.",
          );
          return;
        }
        setCurrentStep("vote");
        setPhase("writing");
        const hash = await writeContractAsync({
          address: OPTIMIZER_ADDRESS,
          abi: optimizerAbi,
          functionName: "setManualAllocation",
          args: [
            allocation.map((e) => e.gauge) as readonly Address[],
            allocation.map((e) => BigInt(e.weightBps)),
          ],
        });
        setTxHash(hash);
        setPhase("confirming");
        return;
      }
      // Custom mode is a UI-side decision; this hook should never be
      // called for it. Surface a clear error if it happens.
      setPhase("error");
      setErrorMessage(
        "Custom strategy is configured via the manual editor, not this activate flow.",
      );
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setPhase("error");
      setErrorMessage(e.shortMessage ?? e.message ?? "Activation failed");
    }
  };

  return {
    status: phase,
    txHash,
    errorMessage,
    isDelegated: !!delegatedQuery.data,
    currentStep,
    preview,
    activate,
    reset: () => {
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
      setCurrentStep(undefined);
    },
  };
}
