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
  MEZO_TOKEN_ADDRESS,
  MEZO_NETWORK,
} from "@/lib/contracts";
import { optimizerAbi, veMezoAbi, veMezoNftAbi, mezoErc20Abi } from "@/lib/abi";
import { MIN_VEMEZO_LOCK_SECONDS } from "@/lib/constants";
import { useRealVeMezoPosition } from "@/hooks/useRealVeMezoPosition";
import type { Address } from "@/lib/types";
import type { Gauge } from "@/lib/types";
import {
  type StrategyPreset,
  type AllocationEntry,
} from "./presets";

/**
 * Pattern matcher for the Cosmos-side authorization-expired revert:
 * MEZO is a Cosmos-native asset surfaced as ERC-20 via a precompile.
 * `approve()` sets EVM allowance but dispatches `cosmos.bank.MsgSend`
 * internally — which requires a separate Cosmos authorization with its
 * own TTL. Once that grant expires, the NEXT `createLock` reverts with
 * this string even though EVM allowance is still in place.
 *
 * When we detect this exact shape we surface a Re-sign Cosmos approval
 * CTA in the modal that re-fires the approve write (which freshens the
 * Cosmos grant) instead of leaving the user staring at a generic
 * "Transaction reverted" toast and guessing.
 */
const COSMOS_TTL_EXPIRED_PATTERN =
  /MsgSend authorization (type does not exist|is expired)/i;

function isCosmosTtlError(message: string | undefined): boolean {
  return !!message && COSMOS_TTL_EXPIRED_PATTERN.test(message);
}

/**
 * Activate a strategy preset on the optimizer.
 *
 * The activation flow ensures every prerequisite is met BEFORE the
 * user-visible "you're now active" message lands, so users never end
 * up in silent-broken states.
 *
 *   1. **Set initial voting power** — if `veMezoBalance === 0` and the
 *      caller passed a `lockAmountWei`, the hook fires the network-
 *      specific path that mints/locks voting power before delegate:
 *        - Testnet → `MockVeMezo.mint(user, amount)`.
 *        - Mainnet → `MEZO.approve(VeMEZO_NFT, amount)` then
 *          `VeMEZO.createLock(amount, MIN_VEMEZO_LOCK_SECONDS)`.
 *      Without this the optimizer's `delegate()` reverts with
 *      `NotEligibleToDelegate` (`MezoYieldOptimizer.sol:198`), burning
 *      gas for nothing.
 *
 *   2. **Delegate** — if not already delegated, submit `delegate(user)`.
 *      The keeper iterates `_delegatedUsers`; without this the wallet
 *      is invisible at vote time even if everything else is correct.
 *
 *   3. **NFT adapter approval (mainnet only)** — `BoostVoter` requires
 *      `isApprovedOrOwner(adapter, tokenId)` to vote on behalf of the
 *      user. Without this, every keeper tick skips the user with a
 *      `VoteSkipped` event.
 *
 *   4. **Strategy-specific tx** — delegate-mode short-circuits (step 2
 *      IS the activation). Manual-mode fires `setManualAllocation`.
 *
 * Each step's tx hash is awaited via `publicClient.waitForTransactionReceipt`
 * before the next is submitted so the user sees a clean sequence in the
 * wallet. `currentStep` is exposed so the activation modal can render
 * "Step 2 of 4: locking MEZO into veMEZO" etc.
 *
 * `network` and `chainId` are exposed as optional args so tests can
 * exercise both networks without touching `process.env` (the constants
 * are resolved at module load).
 */

export type ActivationStep =
  | "mint-vemezo"
  | "approve-mezo"
  | "lock"
  | "delegate"
  | "approve-nft"
  | "vote";

export type ActivationStatus =
  | "idle"
  | "writing"
  | "confirming"
  | "success"
  | "error";

/**
 * Classifier for surfacing typed errors. The modal switches on this to
 * decide whether to show a generic "Transaction reverted" line vs a
 * specific recovery CTA (re-sign Cosmos approval, etc).
 */
export type ActivationErrorKind =
  | "generic"
  | "cosmos-ttl-expired"
  | "missing-input"
  | "unknown-route";

export type ActivateOpts = {
  /**
   * Amount of voting power to mint (testnet) or MEZO to lock (mainnet).
   * Required when the user has zero veMEZO balance; ignored otherwise.
   */
  lockAmountWei?: bigint;
};

export type ActivationState = {
  status: ActivationStatus;
  txHash?: `0x${string}`;
  errorMessage?: string;
  /**
   * Typed error classification. The modal switches on this to render
   * recovery CTAs (e.g. "Re-sign Cosmos approval" for Cosmos TTL errors).
   * `undefined` when no error is active.
   */
  errorKind?: ActivationErrorKind;
  /**
   * True when the connected user already has at least one veMEZO NFT
   * (mainnet only). The modal uses this to switch the Lock tab from
   * "Lock MEZO" → "Add to your lock" and to call increaseAmount on the
   * existing tokenId instead of createLock.
   */
  hasExistingLock: boolean;
  /** True iff the connected user has previously called `delegate()`. */
  isDelegated: boolean;
  /**
   * Current veMEZO voting power. `0n` means the user must mint/lock
   * before `delegate()` will succeed — the modal reads this WITH
   * `veMezoBalanceLoaded` to decide whether to render the
   * Set-Voting-Power section.
   */
  veMezoBalance: bigint;
  /**
   * `true` once the veMEZO balance read has resolved. Until then,
   * `veMezoBalance` is the fallback `0n` and the modal must NOT
   * render the lock section — a returning user with a real lock
   * would otherwise be prompted to lock again.
   */
  veMezoBalanceLoaded: boolean;
  /**
   * Which precondition step the hook is currently writing — `undefined`
   * before any write fires. Lets the activation modal render context
   * like "Step 1 of 4: locking MEZO into veMEZO" while the user signs.
   */
  currentStep?: ActivationStep;
  /** Computed allocation for the chosen preset against current `gauges`. */
  preview: AllocationEntry[];
  activate: (opts?: ActivateOpts) => Promise<void>;
  reset: () => void;
};

interface UseActivateStrategyArgs {
  preset: StrategyPreset;
  user: Address | undefined;
  gauges: Gauge[];
  /** Override for tests; defaults to the build-time `MEZO_NETWORK`. */
  network?: "testnet" | "mainnet";
}

export function useActivateStrategy({
  preset,
  user,
  gauges,
  network = MEZO_NETWORK,
}: UseActivateStrategyArgs): ActivationState {
  const delegatedQuery = useReadContract({
    address: OPTIMIZER_ADDRESS,
    abi: optimizerAbi,
    functionName: "isDelegated",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  // veMEZO balance — on testnet this reads MockVeMezo (ERC-20 shape),
  // on mainnet this reads the VeMezoVotingPower adapter which sums
  // voting power across the user's NFT positions. Both return the
  // same uint256 the optimizer uses to gate `delegate()`, so this
  // single query drives the Set-Voting-Power branch on both networks.
  const veMezoBalanceQuery = useReadContract({
    address: VE_MEZO_ADDRESS,
    abi: veMezoAbi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });

  // Per-NFT lock state — mainnet only. When the user already has one
  // or more veMEZO NFTs, we use `increaseAmount` on the first tokenId
  // instead of `createLock`. The hook gracefully degrades to first-lock
  // behavior when this returns null (testnet, or pre-load).
  const realPosition = useRealVeMezoPosition(user);
  const existingTokenId =
    realPosition.data && realPosition.data.tokenIds.length > 0
      ? realPosition.data.tokenIds[0]!
      : null;
  const hasExistingLock = existingTokenId !== null;

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [errorKind, setErrorKind] = useState<ActivationErrorKind | undefined>(
    undefined,
  );
  const [phase, setPhase] = useState<ActivationStatus>("idle");
  const [currentStep, setCurrentStep] = useState<ActivationStep | undefined>(
    undefined,
  );

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  // Drive the success/error transitions off the receipt. useEffect so
  // we don't setState during render. Critically, `receipt.isSuccess`
  // only means the receipt-read succeeded — the tx itself may have
  // reverted on-chain. Inspect `receipt.data.status` to distinguish.
  useEffect(() => {
    if (phase !== "confirming") return;
    if (receipt.isSuccess) {
      const onchainStatus = receipt.data?.status;
      if (onchainStatus === "success") {
        setPhase("success");
        void delegatedQuery.refetch();
      } else {
        setPhase("error");
        setErrorMessage(
          onchainStatus === "reverted"
            ? "Transaction reverted on-chain."
            : "Transaction confirmed but on-chain status was unrecognized.",
        );
      }
    } else if (receipt.isError) {
      setPhase("error");
      setErrorMessage(
        (receipt.error as Error | null)?.message ?? "Transaction reverted",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, receipt.isSuccess, receipt.isError, receipt.data?.status]);

  const preview =
    preset.execution.mode === "manual"
      ? preset.execution.allocation(gauges)
      : [];

  // Distinguish "loading" from "0 balance". Treating undefined as zero
  // would let a returning user with an existing veMEZO lock open the
  // modal during the in-flight read, click Activate, and submit an
  // unnecessary real-MEZO lock for funds they don't need to lock. The
  // hook + modal both gate the lock branch on `veMezoBalanceLoaded`.
  const veMezoBalanceData = veMezoBalanceQuery.data as bigint | undefined;
  const veMezoBalanceLoaded = veMezoBalanceData !== undefined;
  const veMezoBalance = veMezoBalanceData ?? 0n;

  /**
   * `waitForTransactionReceipt` resolves as soon as the tx is mined,
   * regardless of whether it succeeded or reverted. Without the status
   * check below, a mined-but-reverted `createLock` would fall through
   * into `delegate` and burn gas a second time — exactly the failure
   * mode this whole PR is fixing. Throw on revert so the catch block
   * in `activate()` surfaces a clear error.
   */
  const waitOrRevert = async (
    hash: `0x${string}`,
    label: string,
  ): Promise<void> => {
    // Fail-closed: if the wagmi client isn't available we can't verify
    // the tx, so we can't safely advance to the next step. Surfacing
    // the error lets the user retry once their wallet is settled
    // instead of cascading into a doomed sequence (Codex round 2).
    if (!publicClient) {
      throw new Error(
        `${label}: no RPC client available to confirm tx ${hash}. Reconnect your wallet and retry.`,
      );
    }
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success") {
      throw new Error(`${label} reverted on-chain (tx ${hash}).`);
    }
  };

  const activate = async (opts: ActivateOpts = {}): Promise<void> => {
    if (!user) return;
    setErrorMessage(undefined);
    setErrorKind(undefined);
    try {
      // Defense against the modal-loading race: if a caller fires
      // activate() before the balance read resolves, refuse to act.
      // The modal disables the CTA in this state, so this path is the
      // belt to the modal's suspenders.
      if (!veMezoBalanceLoaded) {
        setPhase("error");
        setErrorMessage(
          "Still reading your veMEZO position — try again in a second.",
        );
        return;
      }

      const isTestnet = network === "testnet";
      const isMainnet = network === "mainnet";

      // ─── Precondition 1: set initial voting power ───
      // Two branches here:
      //   (a) `veMezoBalance === 0n` → user has no voting power; mint or
      //       lock to establish it (network-specific path below).
      //   (b) `opts.lockAmountWei > 0n` AND user already has a lock →
      //       top-up path via increaseAmount(tokenId, amount). Closes
      //       README Known Issue #2 ("no add-to-existing-lock path").
      // Both branches require `opts.lockAmountWei`; if the caller wants
      // to skip them, they pass undefined and we fall through to delegate.
      const wantsTopUp =
        isMainnet &&
        hasExistingLock &&
        !!opts.lockAmountWei &&
        opts.lockAmountWei > 0n;
      if (veMezoBalance === 0n || wantsTopUp) {
        if (!opts.lockAmountWei || opts.lockAmountWei <= 0n) {
          setPhase("error");
          setErrorKind("missing-input");
          setErrorMessage(
            isMainnet
              ? "You have no veMEZO yet — pick an amount of MEZO to lock before activating."
              : "You have no veMEZO yet — pick a starting voting-power amount before activating.",
          );
          return;
        }

        if (isTestnet) {
          // Testnet: MockVeMezo.mint(user, amount). Unrestricted on the
          // mock; gives the user agency over starting voting-power
          // instead of the fixed-1000 faucet shortcut.
          setCurrentStep("mint-vemezo");
          setPhase("writing");
          const mintHash = await writeContractAsync({
            address: VE_MEZO_ADDRESS,
            abi: veMezoAbi,
            functionName: "mint",
            args: [user, opts.lockAmountWei],
          });
          setTxHash(mintHash);
          await waitOrRevert(mintHash, "Testnet veMEZO mint");
          await veMezoBalanceQuery.refetch();
        } else if (isMainnet) {
          if (!MEZO_TOKEN_ADDRESS || !VE_MEZO_NFT_ADDRESS || !publicClient) {
            setPhase("error");
            setErrorMessage(
              "Mainnet configuration incomplete — MEZO or veMEZO NFT address missing.",
            );
            return;
          }

          // Clamp to the current on-chain MEZO balance to defuse the
          // MAX-input race: if a transfer-in/out lands between modal
          // read and submit, the input could exceed actual balance and
          // the approve would still succeed but createLock would
          // revert mid-flight.
          const currentMezo = (await publicClient.readContract({
            address: MEZO_TOKEN_ADDRESS,
            abi: mezoErc20Abi,
            functionName: "balanceOf",
            args: [user],
          })) as bigint;
          const amountWei =
            opts.lockAmountWei > currentMezo ? currentMezo : opts.lockAmountWei;
          if (amountWei <= 0n) {
            setPhase("error");
            setErrorMessage(
              "You don't have any MEZO to lock. Bridge or swap on Mezo first.",
            );
            return;
          }

          // Allowance short-circuit: if a previous activate attempt set
          // allowance but the create/increase never landed (user cancelled
          // between approve and the second tx), skip the approve write.
          const allowance = (await publicClient.readContract({
            address: MEZO_TOKEN_ADDRESS,
            abi: mezoErc20Abi,
            functionName: "allowance",
            args: [user, VE_MEZO_NFT_ADDRESS],
          })) as bigint;

          if (allowance < amountWei) {
            setCurrentStep("approve-mezo");
            setPhase("writing");
            const approveHash = await writeContractAsync({
              address: MEZO_TOKEN_ADDRESS,
              abi: mezoErc20Abi,
              functionName: "approve",
              args: [VE_MEZO_NFT_ADDRESS, amountWei],
            });
            setTxHash(approveHash);
            await waitOrRevert(approveHash, "MEZO approve");
          }

          // Branch: top up an existing NFT, or create a fresh lock.
          if (hasExistingLock && existingTokenId !== null) {
            setCurrentStep("lock");
            setPhase("writing");
            const topUpHash = await writeContractAsync({
              address: VE_MEZO_NFT_ADDRESS,
              abi: veMezoNftAbi,
              functionName: "increaseAmount",
              args: [existingTokenId, amountWei],
            });
            setTxHash(topUpHash);
            await waitOrRevert(topUpHash, "veMEZO increaseAmount");
          } else {
            setCurrentStep("lock");
            setPhase("writing");
            const lockHash = await writeContractAsync({
              address: VE_MEZO_NFT_ADDRESS,
              abi: veMezoNftAbi,
              functionName: "createLock",
              args: [amountWei, MIN_VEMEZO_LOCK_SECONDS],
            });
            setTxHash(lockHash);
            await waitOrRevert(lockHash, "veMEZO createLock");
          }
          await veMezoBalanceQuery.refetch();
        }
      }

      // ─── Precondition 2: ensure delegation ───
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
        await waitOrRevert(delegateHash, "Optimizer delegate");
        await delegatedQuery.refetch();
      }

      // ─── Precondition 3 (mainnet only): NFT adapter approval ───
      // `BoostVoter.vote(tokenId, …)` is called by the adapter as
      // `msg.sender`. Solidly-style BoostVoter requires
      // `isApprovedOrOwner(adapter, tokenId)` — so the user must grant
      // the adapter operator-of-all on their veMEZO NFT once. Without
      // this every keeper tick skips the user with a `VoteSkipped`
      // event.
      //
      // Codex round 3: this branch used to silently skip when
      // `publicClient` was undefined, which let mainnet users reach
      // `success` without ever verifying the NFT approval — leaving
      // the keeper-path broken despite a green activation. Fail
      // closed when mainnet config or RPC client is incomplete.
      if (isMainnet) {
        if (!VE_MEZO_NFT_ADDRESS || !publicClient) {
          setPhase("error");
          setErrorMessage(
            "Mainnet configuration incomplete — veMEZO NFT address or RPC client missing. Reconnect your wallet and retry.",
          );
          return;
        }
        const isApproved = (await publicClient.readContract({
          address: VE_MEZO_NFT_ADDRESS,
          abi: veMezoNftAbi,
          functionName: "isApprovedForAll",
          args: [user, GAUGE_CONTROLLER_ADDRESS],
        })) as boolean;
        if (!isApproved) {
          setCurrentStep("approve-nft");
          setPhase("writing");
          const approveHash = await writeContractAsync({
            address: VE_MEZO_NFT_ADDRESS,
            abi: veMezoNftAbi,
            functionName: "setApprovalForAll",
            args: [GAUGE_CONTROLLER_ADDRESS, true],
          });
          setTxHash(approveHash);
          await waitOrRevert(approveHash, "Adapter setApprovalForAll");
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
      const msg = e.shortMessage ?? e.message ?? "Activation failed";
      setPhase("error");
      setErrorMessage(msg);
      // Classify so the modal can render a recovery CTA instead of a
      // generic toast. Cosmos TTL is the only typed kind right now;
      // everything else stays "generic".
      setErrorKind(isCosmosTtlError(msg) ? "cosmos-ttl-expired" : "generic");
    }
  };

  return {
    status: phase,
    txHash,
    errorMessage,
    errorKind,
    hasExistingLock,
    isDelegated: !!delegatedQuery.data,
    veMezoBalance,
    veMezoBalanceLoaded,
    currentStep,
    preview,
    activate,
    reset: () => {
      setPhase("idle");
      setTxHash(undefined);
      setErrorMessage(undefined);
      setErrorKind(undefined);
      setCurrentStep(undefined);
    },
  };
}

// Re-export the classifier for tests + the modal's typed-error branch.
export { isCosmosTtlError };
