import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  computeEpochCountdown,
  EPOCH_SECONDS,
} from "@/hooks/useEpochCountdown";
import { EpochCountdown } from "@/components/Dashboard/EpochCountdown";

/**
 * Pure-function lock-in for `computeEpochCountdown`. STORY-006 BDD:
 *   - Shows "X days, Y hours, Z minutes until next epoch"
 *   - Progress bar fills 0–100% across the epoch duration
 *   - Drops below 1 minute → "Epoch renews in <1 min" (no negatives)
 */
describe("computeEpochCountdown", () => {
  it("formats a fresh epoch as full days remaining", () => {
    // now is exactly an epoch boundary; remaining is one full epoch.
    // Pick a now that's a multiple of EPOCH_SECONDS so we're at boundary.
    const now = 100 * EPOCH_SECONDS;
    const c = computeEpochCountdown(now);
    expect(c.remainingSeconds).toBe(EPOCH_SECONDS);
    expect(c.label).toMatch(/7d 0h 0m until next epoch/);
    expect(c.progress).toBe(0);
  });

  it("formats partial-epoch progress correctly", () => {
    // Halfway through the epoch.
    const now = 100 * EPOCH_SECONDS + Math.floor(EPOCH_SECONDS / 2);
    const c = computeEpochCountdown(now);
    expect(c.progress).toBeCloseTo(0.5, 2);
    expect(c.label).toContain("until next epoch");
  });

  it("collapses to '<1 min' when remaining drops below 60 seconds", () => {
    const now = 100 * EPOCH_SECONDS - 30; // 30 seconds before next boundary
    const c = computeEpochCountdown(now);
    expect(c.remainingSeconds).toBeLessThan(60);
    expect(c.label).toBe("Epoch renews in <1 min");
  });

  it("never returns a negative remaining or progress > 1", () => {
    // Edge case: now exactly on the boundary.
    const now = 100 * EPOCH_SECONDS;
    const c = computeEpochCountdown(now);
    expect(c.remainingSeconds).toBeGreaterThanOrEqual(0);
    expect(c.progress).toBeGreaterThanOrEqual(0);
    expect(c.progress).toBeLessThanOrEqual(1);
  });
});

describe("EpochCountdown component", () => {
  it("renders a non-empty label and progress bar regardless of wallet state", () => {
    render(<EpochCountdown />);
    expect(screen.getByTestId("epoch-countdown")).toBeInTheDocument();
    expect(screen.getByTestId("epoch-countdown-label")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("epoch-countdown-progress")).toBeInTheDocument();
  });
});
