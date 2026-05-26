"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { formatUnits, parseUnits } from "viem";
import { ExternalLink, Sparkles, RotateCw } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { autoAllocate, estimateWeeklyMusdWei, TOTAL_BPS } from "@/lib/optimize";
import { useActivateStrategy } from "./useActivateStrategy";
import { type StrategyPreset, SET_AND_FORGET_ID } from "./presets";
import type { Address, Gauge } from "@/lib/types";
import { MEZO_EXPLORER, MEZO_NETWORK, OPTIMIZER_ADDRESS } from "@/lib/contracts";
import { formatAddressLong } from "@/lib/format";
import { deriveGaugeDisplay } from "@/lib/gaugeMetadata";
import { TokenPair } from "@/features/gauges/TokenPair";

// Testnet cap on the self-mint amount — keeps the input from accepting
// arbitrarily-large strings that would build but fail at the wallet.
const TESTNET_MINT_CAP_WEI = 10_000n * 10n ** 18n;

type ActiveTab = "lock" | "preview" | "confirm";

interface StrategyDetailModalProps {
  preset: StrategyPreset | null;
  user: Address | undefined;
  gauges: Gauge[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Three-tab activation modal — Lock | Preview | Confirm. Replaces the
 * earlier 11-section vertical scroll with a controlled tab strip that
 * walks the user through reading the allocation before they sign.
 *
 * Tab visibility:
 *   - Lock tab: only mounted when the user needs to (or chooses to)
 *     touch their lock — i.e. `needsInitialVotingPower` (zero balance)
 *     OR mainnet `hasExistingLock` (top-up via increaseAmount).
 *   - Preview + Confirm: always mounted.
 *
 * Footer CTA changes per tab:
 *   - Lock    → "Next: Preview" (advance, no chain call)
 *   - Preview → "Next: Confirm" (advance, no chain call)
 *   - Confirm → real Activate (writes to chain)
 *
 * Cosmos TTL recovery: when `activation.errorKind === "cosmos-ttl-expired"`
 * the Confirm panel surfaces a "Re-sign Cosmos approval and retry" CTA
 * that re-fires the activation (which re-runs the approve write,
 * freshening the Cosmos-side authorization grant).
 */
export function StrategyDetailModal({
  preset,
  user,
  gauges,
  open,
  onOpenChange,
}: StrategyDetailModalProps) {
  const safePreset = preset ?? FALLBACK_PRESET;
  const activation = useActivateStrategy({
    preset: safePreset,
    user,
    gauges,
  });

  const position = useVeMezoPosition(user);
  const tokenBalances = useTokenBalances(user);

  const [inputAmount, setInputAmount] = useState<string>("");
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("preview");

  const isMainnet = MEZO_NETWORK === "mainnet";
  const needsInitialVotingPower =
    activation.veMezoBalanceLoaded && activation.veMezoBalance === 0n;
  // Lock tab is mounted when the user has zero balance OR has an
  // existing NFT they could top up (mainnet only — testnet just mints).
  const showLockTab =
    needsInitialVotingPower || (isMainnet && activation.hasExistingLock);
  // Top-up mode: user has an existing NFT and we'll use increaseAmount
  // instead of createLock. Affects copy + which network branch fires.
  const isTopUpMode =
    isMainnet && activation.hasExistingLock && !needsInitialVotingPower;

  useEffect(() => {
    if (open && preset) {
      activation.reset();
      setInputAmount("");
      setActivePreset(null);
      setActiveTab(needsInitialVotingPower && showLockTab ? "lock" : "preview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset?.id]);

  // Force-jump to Confirm on activation error so the user sees the
  // failure context (including the typed Cosmos TTL recovery CTA).
  useEffect(() => {
    if (activation.status === "error") setActiveTab("confirm");
  }, [activation.status]);

  if (!preset) return null;

  // Parse input → wei. Returns 0n on empty/invalid.
  const lockAmountWei = (() => {
    if (!inputAmount || inputAmount === ".") return 0n;
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
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    setInputAmount(v);
    setActivePreset(null);
  };

  const isDelegate = preset.execution.mode === "delegate";
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

  // ─── Footer CTA — switches by active tab ───
  // Codex P2 fix: if the user typed something in top-up mode, it has to
  // be a valid amount before we proceed. Silently passing `undefined`
  // would tell the hook "no top-up" and the activation would still
  // succeed — but without the lock change the user asked for. So when
  // top-up input is non-empty but invalid, block the submit instead.
  const topUpInputDirty = isTopUpMode && inputAmount !== "" && inputAmount !== ".";
  const topUpInputInvalid = topUpInputDirty && !lockAmountValid;
  const submitActivate = () =>
    void activation.activate(
      needsInitialVotingPower || (isTopUpMode && lockAmountValid)
        ? { lockAmountWei }
        : undefined,
    );

  const ctaLabel = (() => {
    if (activation.status === "writing") return "Confirm in wallet…";
    if (activation.status === "confirming") return "Settling on chain…";
    if (activation.status === "success") return "Activated ✓";
    if (activeTab === "lock") return "Next: Preview";
    if (activeTab === "preview") return "Next: Confirm";
    // Confirm tab → real activate
    if (isDelegate) {
      return activation.isDelegated ? "Re-confirm delegation" : "Delegate & activate";
    }
    return "Activate strategy";
  })();

  const ctaDisabled = (() => {
    if (!user || isBusy || isDone) return true;
    if (activeTab === "lock") {
      // Lock tab → block "Next" when:
      //   - first-lock branch requires a valid amount
      //   - top-up branch with a dirty input requires that input be valid
      //     (Codex P2: don't let users advance with garbage input that
      //     would later be silently dropped)
      if (needsInitialVotingPower) return !lockAmountValid;
      if (isTopUpMode) return topUpInputInvalid;
      return true;
    }
    if (activeTab === "preview") return false;
    // Confirm tab — block on incomplete reads, on missing required input,
    // or on dirty-but-invalid top-up input.
    if (!activation.veMezoBalanceLoaded) return true;
    if (!activation.realPositionLoaded) return true;
    if (needsInitialVotingPower && !lockAmountValid) return true;
    if (topUpInputInvalid) return true;
    return false;
  })();

  const onCtaClick = () => {
    if (activeTab === "lock") {
      setActiveTab("preview");
      return;
    }
    if (activeTab === "preview") {
      setActiveTab("confirm");
      return;
    }
    submitActivate();
  };

  const stepLabel = (() => {
    if (!activation.currentStep) return null;
    const labels: Record<string, string> = {
      "mint-vemezo": "Minting testnet veMEZO",
      "approve-mezo": "Approving MEZO transfer",
      lock: isTopUpMode ? "Topping up your lock" : "Locking MEZO into veMEZO",
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

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList variant="line" className="w-full justify-start gap-3 border-b border-border">
            {showLockTab && (
              <TabsTrigger value="lock" disabled={isBusy}>
                {isTopUpMode ? "Add to lock" : "Lock"}
              </TabsTrigger>
            )}
            <TabsTrigger value="preview" disabled={isBusy}>
              Preview
            </TabsTrigger>
            <TabsTrigger value="confirm" disabled={isBusy && activation.status === "writing"}>
              Confirm
            </TabsTrigger>
          </TabsList>

          {showLockTab && (
            <TabsContent value="lock" className="space-y-3 pt-3">
              <LockPanel
                isMainnet={isMainnet}
                isTopUp={isTopUpMode}
                mezoAvailableWei={mezoAvailableWei}
                presetValues={presetValues}
                activePreset={activePreset}
                applyPreset={applyPreset}
                inputAmount={inputAmount}
                handleInputChange={handleInputChange}
                isBusy={isBusy}
                inputError={
                  topUpInputInvalid
                    ? `Amount exceeds your ${Number(formatUnits(mezoAvailableWei, 18)).toFixed(2)} MEZO balance.`
                    : null
                }
              />
            </TabsContent>
          )}

          <TabsContent value="preview" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">{preset.description}</p>
            <ProjectedRewardCard
              weeklyMusd={weeklyMusd}
              userVeMezoWei={position.balanceWei}
            />
            {allocationPreview.length > 0 && (
              <AllocationCard
                isDelegate={isDelegate}
                allocation={allocationPreview}
                gauges={gauges}
              />
            )}
          </TabsContent>

          <TabsContent value="confirm" className="space-y-3 pt-3">
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

            {stepLabel && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-mezo"
                />
                <span className="font-mono">{stepLabel}…</span>
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

            {isErr && activation.errorKind === "cosmos-ttl-expired" && (
              <CosmosTtlRecoveryCard onRetry={submitActivate} disabled={isBusy} />
            )}

            {isErr &&
              activation.errorKind !== "cosmos-ttl-expired" &&
              activation.errorMessage && (
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
          </TabsContent>
        </Tabs>

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
            onClick={onCtaClick}
            disabled={ctaDisabled}
            className="bg-mezo text-primary-foreground hover:bg-mezo-hover"
          >
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────── Sub-panels ─────────────────────

function LockPanel({
  isMainnet,
  isTopUp,
  mezoAvailableWei,
  presetValues,
  activePreset,
  applyPreset,
  inputAmount,
  handleInputChange,
  isBusy,
  inputError,
}: {
  isMainnet: boolean;
  isTopUp: boolean;
  mezoAvailableWei: bigint;
  presetValues: number[];
  activePreset: number | null;
  applyPreset: (n: number) => void;
  inputAmount: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  isBusy: boolean;
  inputError: string | null;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
          {isMainnet ? (isTopUp ? "Add MEZO to lock" : "Lock MEZO") : "Get testnet veMEZO"}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {isMainnet
            ? `${Number(formatUnits(mezoAvailableWei, 18)).toFixed(2)} MEZO available`
            : "Testnet · pick any amount"}
        </span>
      </div>

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

      <p className="text-[10px] text-muted-foreground">
        {isMainnet
          ? isTopUp
            ? "Tops up your existing lock via increaseAmount. The unlock date stays the same."
            : "Locked 1 week minimum. Extend or unlock after the first epoch."
          : "Testnet only · free · no real lock."}
      </p>

      {isMainnet && mezoAvailableWei === 0n && (
        <p className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-400">
          You don&apos;t have any MEZO yet. Bridge or swap on Mezo first, then come back.
        </p>
      )}

      {inputError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
        >
          {inputError}
        </p>
      )}
    </div>
  );
}

function ProjectedRewardCard({
  weeklyMusd,
  userVeMezoWei,
}: {
  weeklyMusd: number;
  userVeMezoWei: bigint;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Your projected reward
        </span>
        <span className="font-mono text-base text-foreground">
          {userVeMezoWei === 0n ? (
            "— MUSD/wk"
          ) : (
            <>≈ {weeklyMusd.toFixed(2)} MUSD/wk</>
          )}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Your veMEZO</span>
        <span className="font-mono text-foreground">
          {Number(formatUnits(userVeMezoWei, 18)).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function AllocationCard({
  isDelegate,
  allocation,
  gauges,
}: {
  isDelegate: boolean;
  allocation: { gauge: Address; weightBps: number }[];
  gauges: Gauge[];
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-baseline justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Allocation</span>
        {isDelegate && (
          <span className="text-mezo">re-balanced each epoch</span>
        )}
      </div>
      {allocation.map((entry) => {
        const g = gauges.find((x) => x.address === entry.gauge);
        const name = g?.name ?? entry.gauge;
        const display = g ? deriveGaugeDisplay(g.name) : null;
        return (
          <div
            key={entry.gauge}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              {display && <TokenPair tokens={display.tokens} size={16} />}
              <span className="truncate text-foreground">{name}</span>
            </div>
            <span className="font-mono text-foreground">
              {((entry.weightBps / TOTAL_BPS) * 100).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CosmosTtlRecoveryCard({
  onRetry,
  disabled,
}: {
  onRetry: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
      <p className="font-semibold text-amber-300">
        Cosmos approval expired
      </p>
      <p className="text-amber-200/90">
        MEZO uses a Cosmos precompile; the Cosmos-side authorization expires
        with its own TTL. Re-sign the approval and we&apos;ll finish the lock
        in the same flow.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/20 px-2 py-1 text-amber-100 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
      >
        <RotateCw className="h-3 w-3" />
        Re-sign approval and retry
      </button>
    </div>
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
