"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { formatUnits, parseUnits } from "viem";
import { ExternalLink, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { autoAllocate, estimateWeeklyMusdWei, TOTAL_BPS } from "@/lib/optimize";
import { useActivateStrategy } from "./useActivateStrategy";
import { type StrategyPreset, SET_AND_FORGET_ID } from "./presets";
import type { Address, Gauge } from "@/lib/types";
import { MEZO_EXPLORER, MEZO_NETWORK, OPTIMIZER_ADDRESS } from "@/lib/contracts";
import { formatAddressLong } from "@/lib/format";

// Testnet cap on the self-mint amount — keeps the input from accepting
// arbitrarily-large strings that would build but fail at the wallet.
// 10k veMEZO is well above the demo-relevant range; tighten later if
// the keeper starts iterating dust positions slowly.
const TESTNET_MINT_CAP_WEI = 10_000n * 10n ** 18n;

interface StrategyDetailModalProps {
  preset: StrategyPreset | null;
  user: Address | undefined;
  gauges: Gauge[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirm dialog for strategy activation. Shows the proposed allocation
 * (gauge name + weight%), the user's projected weekly MUSD against
 * THEIR live veMEZO balance, and explains what happens on confirm
 * (delegate vs manual). On submit, drives the activate hook through
 * writing → confirming → success / error.
 */
export function StrategyDetailModal({
  preset,
  user,
  gauges,
  open,
  onOpenChange,
}: StrategyDetailModalProps) {
  // Only call the hook when we have a preset (it expects a non-null one).
  // Guard with a fallback dummy preset that has mode "custom" — the hook
  // never triggers a write in custom mode, so it's a safe no-op.
  const safePreset = preset ?? FALLBACK_PRESET;
  const activation = useActivateStrategy({
    preset: safePreset,
    user,
    gauges,
  });

  const position = useVeMezoPosition(user);
  const tokenBalances = useTokenBalances(user);

  // ── Set-Voting-Power local state ──
  // `inputAmount` is the raw text in the field (so users can type
  // "1.5"); `activePreset` is the selected preset button (or `null` if
  // the input has been edited freely). Both reset when the modal opens
  // for a new preset.
  const [inputAmount, setInputAmount] = useState<string>("");
  const [activePreset, setActivePreset] = useState<number | null>(null);

  // Reset hook state when the modal opens with a new preset.
  useEffect(() => {
    if (open && preset) {
      activation.reset();
      setInputAmount("");
      setActivePreset(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset?.id]);

  if (!preset) return null;

  const isMainnet = MEZO_NETWORK === "mainnet";
  // Gate the lock section on BOTH a resolved read AND a true-zero balance.
  // While the read is in-flight, render nothing and disable Activate —
  // otherwise a returning user with an existing lock could be re-prompted
  // for funds they've already locked.
  const needsInitialVotingPower =
    activation.veMezoBalanceLoaded && activation.veMezoBalance === 0n;

  // Parse input → wei. Returns 0n on empty/invalid so the validator
  // logic stays simple downstream.
  const lockAmountWei = (() => {
    if (!inputAmount || inputAmount === "." ) return 0n;
    try {
      return parseUnits(inputAmount, 18);
    } catch {
      return 0n;
    }
  })();

  const mezoAvailableWei = tokenBalances.data.mezoWei;
  const lockAmountValid =
    lockAmountWei > 0n &&
    (isMainnet
      ? lockAmountWei <= mezoAvailableWei
      : lockAmountWei <= TESTNET_MINT_CAP_WEI);

  // Preset percentages on mainnet (of available MEZO balance);
  // literal-amount presets on testnet so the input maps directly to
  // "give me X veMEZO."
  const presetValues = isMainnet ? [25, 50, 75, 100] : [250, 500, 750, 1000];

  const applyPreset = (preset: number) => {
    setActivePreset(preset);
    if (isMainnet) {
      const bps = BigInt(preset);
      const amount = (mezoAvailableWei * bps) / 100n;
      setInputAmount(formatUnits(amount, 18));
    } else {
      setInputAmount(preset.toString());
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    // Allow digits + at most one decimal point; reject anything else
    // so the parser doesn't choke and presets stay in sync with edits.
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    setInputAmount(v);
    setActivePreset(null);
  };

  const isDelegate = preset.execution.mode === "delegate";
  // Manual presets carry their own allocation function. Delegate (Set &
  // Forget) defers to the keeper, which runs `autoAllocate` against live
  // gauges every epoch — so for the activation projection we run the
  // same algorithm here. Codex P2: previously fed `activation.preview`
  // (which is `[]` for delegate mode) into `estimateWeeklyMusdWei`, so
  // the recommended strategy always rendered "≈ 0.00 MUSD/wk" no matter
  // the user's veMEZO balance — silently lied to the user about the
  // best path.
  const allocationPreview =
    preset.execution.mode === "manual"
      ? preset.execution.allocation(gauges)
      : isDelegate
        ? autoAllocate(gauges)
        : [];

  const weeklyWei = estimateWeeklyMusdWei(
    position.balanceWei,
    allocationPreview,
    gauges,
  );
  const weeklyMusd = Number(formatUnits(weeklyWei, 18));

  const isBusy =
    activation.status === "writing" || activation.status === "confirming";
  const isDone = activation.status === "success";
  const isErr = activation.status === "error";

  const ctaLabel = (() => {
    if (activation.status === "writing") return "Confirm in wallet…";
    if (activation.status === "confirming") return "Settling on chain…";
    if (activation.status === "success") return "Activated ✓";
    if (isDelegate) {
      return activation.isDelegated ? "Re-confirm delegation" : "Delegate & activate";
    }
    return "Activate strategy";
  })();

  // Step indicator label — surfaces the multi-step nature of the
  // activate flow so users don't think the wallet popup that says
  // "Set approval for all" appeared out of nowhere. Testnet skips
  // the approve/lock pair (mock takes a single `mint` call), so the
  // sequence the user sees depends on network + their starting state.
  const stepLabel = (() => {
    if (!activation.currentStep) return null;
    const labels: Record<string, string> = {
      "mint-vemezo": "Minting testnet veMEZO",
      "approve-mezo": "Approving MEZO transfer",
      lock: "Locking MEZO into veMEZO",
      "approve-nft": "Approving adapter on veMEZO NFT",
      delegate: "Delegating to optimizer",
      vote: "Setting allocation",
    };
    return labels[activation.currentStep] ?? activation.currentStep;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-lg font-semibold">
              {preset.name}
            </DialogTitle>
            <Badge
              className={cn(
                preset.riskTone === "low" && "bg-emerald-500/10 text-emerald-400",
                preset.riskTone === "medium" && "bg-amber-500/10 text-amber-400",
                preset.riskTone === "high" && "bg-red-500/10 text-red-400",
                preset.riskTone === "neutral" && "bg-foreground/10 text-foreground/70",
              )}
            >
              {preset.riskLabel}
            </Badge>
          </div>
          <DialogDescription>{preset.tagline}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {needsInitialVotingPower && (
            <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
              {/* Row 1: title + balance/info */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                  {isMainnet ? "Lock MEZO" : "Get testnet veMEZO"}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {isMainnet
                    ? `${Number(formatUnits(mezoAvailableWei, 18)).toFixed(2)} MEZO available`
                    : "Testnet · pick any amount"}
                </span>
              </div>

              {/* Row 2: preset buttons (left) + input (right), side-by-side */}
              <div className="flex items-stretch gap-2">
                <div className="flex flex-1 gap-1">
                  {presetValues.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      disabled={isBusy || (isMainnet && mezoAvailableWei === 0n)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1.5 text-xs transition-colors disabled:opacity-50",
                        activePreset === p
                          ? "border border-mezo bg-mezo-soft text-mezo"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {isMainnet ? (p === 100 ? "MAX" : `${p}%`) : p.toString()}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={inputAmount}
                    onChange={handleInputChange}
                    disabled={isBusy}
                    className="h-full w-full rounded-md border border-border bg-card/40 px-2 py-1.5 pr-12 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-mezo focus:outline-none disabled:opacity-50"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
                    {isMainnet ? "MEZO" : "veMEZO"}
                  </span>
                </div>
              </div>

              {/* Row 3: one-line disclosure */}
              <p className="text-[10px] text-muted-foreground">
                {isMainnet
                  ? "Locked 1 week minimum. Extend or unlock after the first epoch."
                  : "Testnet only · free · no real lock."}
              </p>

              {isMainnet && mezoAvailableWei === 0n && (
                <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-400">
                  You don&apos;t have any MEZO yet. Bridge or swap on Mezo first, then come back.
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">{preset.description}</p>

          <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Your projected reward
              </span>
              <span className="font-mono text-base text-foreground">
                {position.balanceWei === 0n ? (
                  "— MUSD/wk"
                ) : (
                  <>≈ {weeklyMusd.toFixed(2)} MUSD/wk</>
                )}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>Your veMEZO</span>
              <span className="font-mono text-foreground">
                {Number(formatUnits(position.balanceWei, 18)).toFixed(2)}
              </span>
            </div>
          </div>

          {allocationPreview.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
              <div className="flex items-baseline justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>Allocation</span>
                {isDelegate && (
                  <span className="text-mezo">re-balanced each epoch</span>
                )}
              </div>
              {allocationPreview.map((entry) => {
                const g = gauges.find((x) => x.address === entry.gauge);
                return (
                  <div
                    key={entry.gauge}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground">
                      {g?.name ?? entry.gauge}
                    </span>
                    <span className="font-mono text-foreground">
                      {((entry.weightBps / TOTAL_BPS) * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {isDelegate && (
            <div className="flex items-start gap-2 rounded-md border border-mezo/20 bg-mezo-soft px-3 py-2 text-xs text-mezo">
              <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {activation.isDelegated
                  ? "You're already delegated. Confirming again is a no-op but doesn't hurt."
                  : "On confirm, you'll sign one tx to delegate voting power. The keeper bot then re-votes for you at every weekly epoch boundary — no further action from you."}
              </span>
            </div>
          )}

          {activation.txHash && (
            <a
              href={`${MEZO_EXPLORER}/tx/${activation.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-mezo hover:underline"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {isErr && activation.errorMessage && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {activation.errorMessage}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Calls the optimizer at{" "}
            <a
              href={`${MEZO_EXPLORER}/address/${OPTIMIZER_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline-offset-2 hover:underline"
            >
              {formatAddressLong(OPTIMIZER_ADDRESS)}
            </a>
            . Non-custodial — your veMEZO never moves.
          </p>
        </div>

        {stepLabel && (
          <div className="-mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-mezo"
            />
            <span className="font-mono">{stepLabel}…</span>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            {isDone ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={() =>
              void activation.activate(
                needsInitialVotingPower ? { lockAmountWei } : undefined,
              )
            }
            disabled={
              !user ||
              isBusy ||
              isDone ||
              !activation.veMezoBalanceLoaded ||
              (needsInitialVotingPower && !lockAmountValid)
            }
            className="bg-mezo text-primary-foreground hover:bg-mezo-hover"
          >
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Pseudo-preset used only when the modal is closed (no preset selected).
const FALLBACK_PRESET: StrategyPreset = {
  id: "_fallback",
  name: "",
  tagline: "",
  description: "",
  riskLabel: "",
  riskTone: "neutral",
  execution: { mode: "custom" },
};

void SET_AND_FORGET_ID;
