import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * BDD coverage for the landing's <ProtocolEarningsChart />:
 *   - Pre-walletReady → renders skeleton (NOT the inner chart).
 *   - With aggregated bribe data → renders the BarChart with MUSD totals.
 *   - Empty state (zero bribes) → renders an explicit empty-state line.
 *   - MUSD-only, no BTC toggle (Codex P1 regression).
 *   - Error → renders an inline error block.
 */

const walletReadyState = { value: true };
vi.mock("@/app/providers", () => ({
  useWalletReady: () => walletReadyState.value,
}));

type Bucket = { epoch: number; musdWei: bigint };
type GaugeBribe = { gauge: `0x${string}`; amountWei: bigint };
type HookResult = {
  epochs: Bucket[];
  byGauge: GaugeBribe[];
  uniqueGauges: number;
  source: "rpc" | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

const hookState: { value: HookResult } = {
  value: {
    epochs: [],
    byGauge: [],
    uniqueGauges: 0,
    source: "rpc",
    isLoading: false,
    isError: false,
    error: null,
  },
};

vi.mock("@/hooks/useProtocolBribesHistory", () => ({
  useProtocolBribesHistory: () => hookState.value,
}));

// useGaugeData provides human-readable names for each gauge address.
// Mock with the same five gauge addresses the byGauge fixture uses
// so the chart renders human labels rather than truncated hex.
vi.mock("@/hooks/useGaugeData", () => ({
  useGaugeData: () => ({
    gauges: [
      { address: "0x1111111111111111111111111111111111111111", name: "Mezo Gauge 0" },
      { address: "0x2222222222222222222222222222222222222222", name: "Mezo Gauge 1" },
      { address: "0x3333333333333333333333333333333333333333", name: "Mezo Gauge 2" },
      { address: "0x4444444444444444444444444444444444444444", name: "Mezo Gauge 3" },
      { address: "0x5555555555555555555555555555555555555555", name: "Mezo Gauge 4" },
    ],
    isLoading: false,
    isError: false,
    error: null,
    source: "rpc",
    refetch: () => {},
  }),
}));

// Recharts' ResponsiveContainer uses ResizeObserver / element-size; in jsdom
// it renders nothing unless given fixed dimensions. Stub it out so the chart
// renders synchronously with a measurable child tree.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 200 }} data-testid="resp-container">
        {children}
      </div>
    ),
  };
});

import { ProtocolEarningsChart } from "@/features/landing/ProtocolEarningsChart";

const NOW_EPOCH = 1000;

function makeContiguous(values: bigint[]): Bucket[] {
  return values.map((v, i) => ({ epoch: NOW_EPOCH - (7 - i), musdWei: v }));
}

const SAMPLE_BY_GAUGE: GaugeBribe[] = [
  { gauge: "0x1111111111111111111111111111111111111111", amountWei: 8n * 10n ** 18n },
  { gauge: "0x2222222222222222222222222222222222222222", amountWei: 5n * 10n ** 18n },
  { gauge: "0x3333333333333333333333333333333333333333", amountWei: 4n * 10n ** 18n },
  { gauge: "0x4444444444444444444444444444444444444444", amountWei: 4n * 10n ** 18n },
  { gauge: "0x5555555555555555555555555555555555555555", amountWei: 3n * 10n ** 18n },
];

describe("<ProtocolEarningsChart />", () => {
  beforeEach(() => {
    walletReadyState.value = true;
    hookState.value = {
      epochs: makeContiguous([0n, 0n, 1n * 10n ** 18n, 2n * 10n ** 18n, 0n, 3n * 10n ** 18n, 4n * 10n ** 18n, 5n * 10n ** 18n]),
      byGauge: SAMPLE_BY_GAUGE,
      uniqueGauges: SAMPLE_BY_GAUGE.length,
      source: "rpc",
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it("Given the wallet stack is still booting, When rendered, Then it shows the skeleton (not the chart)", () => {
    walletReadyState.value = false;
    render(<ProtocolEarningsChart />);
    expect(screen.getByTestId("protocol-chart-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("protocol-chart")).not.toBeInTheDocument();
  });

  it("Given aggregated bribe data, When rendered, Then it shows the chart with MUSD totals", () => {
    render(<ProtocolEarningsChart />);
    expect(screen.getByTestId("protocol-chart")).toBeInTheDocument();
    expect(
      screen.getByTestId("protocol-chart-currency-label").textContent,
    ).toMatch(/MUSD/);
  });

  it("Given no bribe events on chain, When rendered, Then it shows the empty-state copy", () => {
    hookState.value = {
      ...hookState.value,
      epochs: [],
      byGauge: [],
      uniqueGauges: 0,
    };
    render(<ProtocolEarningsChart />);
    expect(
      screen.getByText(/no bribes posted yet/i),
    ).toBeInTheDocument();
  });

  it("Given rendered, Then totals are MUSD-denominated and no BTC toggle is offered", () => {
    // Codex P1 regression: a prior version had a BTC toggle that
    // multiplied MUSD by a fixed sentinel rate. The chart must stay
    // MUSD-only until a real oracle is wired.
    render(<ProtocolEarningsChart />);
    expect(screen.getByTestId("protocol-chart-currency-label").textContent).toMatch(/MUSD/);
    expect(screen.queryByRole("button", { name: /^BTC$/i })).not.toBeInTheDocument();
  });

  it("Given the hook returns isError, When rendered, Then the error message is surfaced inline (not a blank chart)", () => {
    hookState.value = {
      ...hookState.value,
      epochs: [],
      byGauge: [],
      isError: true,
      error: new Error("indexer 503"),
    };
    render(<ProtocolEarningsChart />);
    expect(screen.getByText(/indexer 503/i)).toBeInTheDocument();
  });
});
