import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Gauge, Address } from "@/lib/types";

/**
 * The "% of protocol veMEZO uses this" line + "most used" badge pill on
 * the Strategies grid. Data source: `useProtocolStrategyMix()`.
 */

type Mix = { strategyId: string; percent: number };
const mixState: {
  value: {
    mix: Mix[];
    mostUsedStrategyId: string | null;
    totalVeMezoWei: bigint;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
} = {
  value: {
    mix: [],
    mostUsedStrategyId: null,
    totalVeMezoWei: 0n,
    isLoading: false,
    isError: false,
    error: null,
  },
};

vi.mock("@/hooks/useProtocolStrategyMix", () => ({
  useProtocolStrategyMix: () => mixState.value,
}));

import { StrategyCard } from "@/features/strategies/StrategyCard";
import { STRATEGY_PRESETS } from "@/features/strategies/presets";

const G_STAB: Gauge = {
  address: "0x0000000000000000000000000000000000000001" as Address,
  name: "Stability Pool",
  totalVeMezoWei: 12_500_000n * 10n ** 18n,
  bribeMUSDWei: 8_400n * 10n ** 18n,
  apyPercent: 3.5,
};

const setForget = STRATEGY_PRESETS.find((p) => p.id === "set-and-forget")!;
const stabMax = STRATEGY_PRESETS.find((p) => p.id === "stability-max")!;

describe("<StrategyCard /> protocol-mix line", () => {
  beforeEach(() => {
    mixState.value = {
      mix: [
        { strategyId: "set-and-forget", percent: 47 },
        { strategyId: "stability-max", percent: 22 },
      ],
      mostUsedStrategyId: "set-and-forget",
      totalVeMezoWei: 25_000_000n * 10n ** 18n,
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it("Given Set & Forget is the most-used strategy, When the card renders, Then the percent line + 'most used' badge are visible", () => {
    render(
      <StrategyCard preset={setForget} gauges={[G_STAB]} onActivate={() => {}} />,
    );
    expect(screen.getByText(/47% of protocol veMEZO/i)).toBeInTheDocument();
    expect(screen.getByText(/most used/i)).toBeInTheDocument();
  });

  it("Given a non-leading strategy, When the card renders, Then only the percent line shows (no badge)", () => {
    render(
      <StrategyCard preset={stabMax} gauges={[G_STAB]} onActivate={() => {}} />,
    );
    expect(screen.getByText(/22% of protocol veMEZO/i)).toBeInTheDocument();
    expect(screen.queryByText(/most used/i)).not.toBeInTheDocument();
  });

  it("Given the protocol total is below the noise floor (empty mix), When the card renders, Then no percent line is shown", () => {
    mixState.value = {
      mix: [],
      mostUsedStrategyId: null,
      totalVeMezoWei: 0n,
      isLoading: false,
      isError: false,
      error: null,
    };
    render(
      <StrategyCard preset={setForget} gauges={[G_STAB]} onActivate={() => {}} />,
    );
    expect(screen.queryByText(/% of protocol veMEZO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/most used/i)).not.toBeInTheDocument();
  });
});
