"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGaugeData } from "@/hooks/useGaugeData";
import { useVeMezoPosition } from "@/hooks/useVeMezoPosition";
import { useSubmitVote } from "@/hooks/useSubmitVote";
import { useWalletReady } from "@/app/providers";
import {
  TOTAL_BPS,
  autoAllocate,
  estimateWeeklyMusdWei,
  summarizeManualAllocation,
  type AllocationEntry,
} from "@/lib/optimize";
import { toast } from "sonner";

type Mode = "auto" | "manual";

export function OptimizeModal() {
  const walletReady = useWalletReady();
  if (!walletReady) {
    return <OptimizeModalSkeleton />;
  }
  return <OptimizeModalInner />;
}

function OptimizeModalSkeleton() {
  return (
    <div
      data-testid="optimize-modal-skeleton"
      className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground"
    >
      Connect wallet to optimize…
    </div>
  );
}

function OptimizeModalInner() {
  const { address } = useAccount();
  const gaugeData = useGaugeData();
  const position = useVeMezoPosition(address);
  const submit = useSubmitVote();

  const [mode, setMode] = useState<Mode>("auto");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Manual: editable per-gauge weights in BPS. Initialized to even split of
  // current gauges so the slider has a sensible start point.
  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!gaugeData.gauges) return;
    setManualWeights((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const n = gaugeData.gauges?.length ?? 0;
      if (n === 0) return prev;
      const each = Math.floor(TOTAL_BPS / n);
      const drift = TOTAL_BPS - each * n;
      const next: Record<string, number> = {};
      gaugeData.gauges?.forEach((g, i) => {
        next[g.address] = each + (i === 0 ? drift : 0);
      });
      return next;
    });
  }, [gaugeData.gauges]);

  const autoEntries: AllocationEntry[] = useMemo(
    () => autoAllocate(gaugeData.gauges ?? []),
    [gaugeData.gauges],
  );

  const manualEntries: AllocationEntry[] = useMemo(
    () =>
      (gaugeData.gauges ?? []).map((g) => ({
        gauge: g.address,
        weightBps: manualWeights[g.address] ?? 0,
      })),
    [gaugeData.gauges, manualWeights],
  );

  const activeEntries = mode === "auto" ? autoEntries : manualEntries;
  const manualSummary = summarizeManualAllocation(manualEntries);
  const submitDisabled =
    !position.isConnected ||
    activeEntries.length === 0 ||
    (mode === "manual" && !manualSummary.isValid) ||
    submit.status === "writing" ||
    submit.status === "confirming";

  const previewWeeklyWei = estimateWeeklyMusdWei(
    position.balanceWei,
    activeEntries,
    gaugeData.gauges ?? [],
  );

  // Surface success / failure toasts on phase change.
  useEffect(() => {
    if (submit.status === "success" && submit.txHash) {
      toast.success(`Vote submitted! Tx: ${submit.txHash.slice(0, 10)}…`);
      setPreviewOpen(false);
      submit.reset();
    } else if (submit.status === "error" && submit.errorMessage) {
      toast.error(`Vote failed: ${submit.errorMessage}`);
    }
    // intentionally narrow deps — phase + tx are the only triggers we want
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit.status, submit.txHash, submit.errorMessage]);

  if (!position.isConnected) {
    return (
      <div
        data-testid="optimize-disconnected"
        className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground"
      >
        Connect wallet to optimize your allocation.
      </div>
    );
  }

  return (
    <div data-testid="optimize-modal" className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Optimization strategy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Auto picks the highest-incentive gauges for you. Manual lets you
          pin your own allocation.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            data-testid="strategy-auto"
            onClick={() => setMode("auto")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              mode === "auto"
                ? "bg-[#F7931A] text-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Auto (max MUSD yield)
          </button>
          <button
            type="button"
            data-testid="strategy-manual"
            onClick={() => setMode("manual")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              mode === "manual"
                ? "bg-[#F7931A] text-black"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Manual
          </button>
        </div>

        {mode === "auto" ? (
          <AutoView entries={autoEntries} gauges={gaugeData.gauges ?? []} />
        ) : (
          <ManualView
            gauges={gaugeData.gauges ?? []}
            weights={manualWeights}
            onChange={setManualWeights}
            summary={manualSummary}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Estimated yield:{" "}
          <span className="font-mono text-foreground" data-testid="optimize-estimate">
            ≈ {Number(formatUnits(previewWeeklyWei, 18)).toFixed(2)} MUSD/week
          </span>
        </div>
        <Button
          data-testid="optimize-preview"
          disabled={submitDisabled}
          onClick={() => setPreviewOpen(true)}
          className="bg-[#F7931A] text-black hover:bg-[#FFA640]"
        >
          Preview &amp; submit
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm vote submission</DialogTitle>
            <DialogDescription>
              {mode === "auto"
                ? "Cast the optimized vote on behalf of all delegated users."
                : "Pin your own allocation. You can change it any time before the next epoch."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            {activeEntries.map((e) => {
              const g = (gaugeData.gauges ?? []).find(
                (x) => x.address.toLowerCase() === e.gauge.toLowerCase(),
              );
              return (
                <div key={e.gauge} className="flex justify-between">
                  <span>{g?.name ?? e.gauge.slice(0, 10)}</span>
                  <span className="font-mono">{(e.weightBps / 100).toFixed(0)}%</span>
                </div>
              );
            })}
            <div className="mt-3 border-t border-border pt-3 text-muted-foreground">
              Estimated yield:{" "}
              <span className="font-mono text-foreground">
                ≈ {Number(formatUnits(previewWeeklyWei, 18)).toFixed(2)} MUSD/week
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={submit.status === "writing" || submit.status === "confirming"}
            >
              Cancel
            </Button>
            <Button
              data-testid="optimize-confirm"
              onClick={() => void submit.submit(mode, activeEntries)}
              disabled={submitDisabled}
              className="bg-[#F7931A] text-black hover:bg-[#FFA640]"
            >
              {submit.status === "writing"
                ? "Confirming…"
                : submit.status === "confirming"
                  ? "Settling…"
                  : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutoView({
  entries,
  gauges,
}: {
  entries: AllocationEntry[];
  gauges: { address: `0x${string}`; name: string }[];
}) {
  if (entries.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground" data-testid="optimize-empty-auto">
        No incentivized gauges this epoch. Try Manual mode.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-2 text-sm" data-testid="optimize-auto-rows">
      {entries.map((e) => {
        const g = gauges.find((x) => x.address.toLowerCase() === e.gauge.toLowerCase());
        return (
          <div
            key={e.gauge}
            className="flex justify-between rounded-md bg-muted/30 px-3 py-2"
          >
            <span>{g?.name ?? e.gauge.slice(0, 10)}</span>
            <span className="font-mono">{(e.weightBps / 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ManualView({
  gauges,
  weights,
  onChange,
  summary,
}: {
  gauges: { address: `0x${string}`; name: string }[];
  weights: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  summary: { totalBps: number; isValid: boolean };
}) {
  return (
    <div className="mt-4 space-y-3 text-sm" data-testid="optimize-manual">
      {gauges.map((g) => {
        const v = weights[g.address] ?? 0;
        return (
          <div key={g.address} className="space-y-1">
            <div className="flex justify-between">
              <span>{g.name}</span>
              <span className="font-mono">{(v / 100).toFixed(0)}%</span>
            </div>
            <Slider
              data-testid={`optimize-slider-${g.address}`}
              value={[v]}
              max={TOTAL_BPS}
              step={100}
              onValueChange={(next) => {
                const v = Array.isArray(next) ? (next[0] ?? 0) : (next as number);
                onChange({ ...weights, [g.address]: v });
              }}
            />
          </div>
        );
      })}
      <div
        className={`text-xs ${
          summary.isValid ? "text-muted-foreground" : "text-destructive"
        }`}
        data-testid="optimize-manual-total"
      >
        Total: {(summary.totalBps / 100).toFixed(0)}%{" "}
        {summary.isValid ? "" : "— adjust to 100% to submit"}
      </div>
    </div>
  );
}
