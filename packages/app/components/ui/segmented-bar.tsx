"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * SegmentedBar — Boar-style segmented progress strip.
 *
 * Renders `max` equal-width pill segments separated by a thin gap. The
 * first `value` segments are filled with the variant color (mezo by
 * default); the remainder sit at a low-opacity ghost color so the
 * group still reads as a single bar.
 *
 * The bar exposes `role="progressbar"` semantics and, when `onSelect`
 * is provided, each segment is also a `<button>` — so the bar itself
 * becomes the control (no hidden slider). This is the pattern Boar
 * uses for the BOOST card on the mezo-2 anchor: the bar IS the input.
 *
 * Value bounds: negative values clamp to 0, values above `max` clamp
 * to `max`. We do not throw on out-of-range input; the bar is a
 * cosmetic representation and a crash here would block the card.
 */

type SegmentedBarVariant = "mezo" | "muted";
type SegmentedBarSize = "sm" | "md";

export type SegmentedBarProps = {
  value: number;
  max: number;
  variant?: SegmentedBarVariant;
  size?: SegmentedBarSize;
  className?: string;
  /**
   * If provided, every segment becomes a button. The handler receives
   * the 1-based index of the clicked segment (so the first segment
   * fires `1`, the last fires `max`). Click-to-set patterns map this
   * directly: e.g. for a 0–100% scale with max=10, segment 3 means 30%.
   */
  onSelect?: (segmentIndex: number) => void;
  /** Optional per-segment hover hint, e.g. the precise %. */
  segmentLabel?: (segmentIndex: number) => string;
  /** Accessible label for the bar as a whole. */
  ariaLabel?: string;
};

const FILLED_VARIANT: Record<SegmentedBarVariant, string> = {
  mezo: "bg-mezo",
  muted: "bg-foreground/60",
};

const GHOST_VARIANT: Record<SegmentedBarVariant, string> = {
  mezo: "bg-mezo/15",
  muted: "bg-foreground/10",
};

const SIZE: Record<SegmentedBarSize, string> = {
  sm: "h-1.5 gap-1",
  md: "h-2.5 gap-1.5",
};

export function SegmentedBar({
  value,
  max,
  variant = "mezo",
  size = "md",
  className,
  onSelect,
  segmentLabel,
  ariaLabel,
}: SegmentedBarProps) {
  const safeMax = Math.max(1, Math.floor(max));
  const clamped = Math.max(0, Math.min(safeMax, Math.floor(value)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={ariaLabel}
      className={cn(
        "flex w-full items-stretch",
        SIZE[size],
        className,
      )}
    >
      {Array.from({ length: safeMax }, (_, i) => {
        const isFilled = i < clamped;
        const fillClass = isFilled
          ? FILLED_VARIANT[variant]
          : GHOST_VARIANT[variant];
        const isFirst = i === 0;
        const isLast = i === safeMax - 1;
        const radius = cn(
          "rounded-sm",
          isFirst && "rounded-l-full",
          isLast && "rounded-r-full",
        );
        const baseSegmentClass = cn(
          "h-full flex-1 transition-colors",
          fillClass,
          radius,
        );
        const label =
          segmentLabel?.(i + 1) ?? `Segment ${i + 1} of ${safeMax}`;
        if (onSelect) {
          return (
            <button
              key={i}
              type="button"
              data-segment={isFilled ? "filled" : "ghost"}
              aria-label={label}
              title={label}
              onClick={() => onSelect(i + 1)}
              className={cn(
                baseSegmentClass,
                "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-mezo/60",
              )}
            />
          );
        }
        return (
          <span
            key={i}
            data-segment={isFilled ? "filled" : "ghost"}
            aria-hidden="true"
            className={baseSegmentClass}
          />
        );
      })}
    </div>
  );
}
