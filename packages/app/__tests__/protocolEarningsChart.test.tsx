import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * BDD coverage for the landing's <ProtocolEarningsChart />:
 *   - Pre-walletReady → renders skeleton (NOT the inner chart).
 *   - With aggregated claim data → renders the BarChart and the currency
 *     toggle in the top-right.
 *   - Empty state (zero claims) → renders an explicit "No claims yet"
 *     empty-state line instead of the chart container.
 *   - Currency toggle → switches the rendered label from MUSD → BTC.
 *   - Error → renders an inline error block.
 */

const walletReadyState = { value: true };
vi.mock("@/app/providers", () => ({
  useWalletReady: () => walletReadyState.value,
}));

type Bucket = { epoch: number; musdWei: bigint };
type HookResult = {
  epochs: Bucket[];
  totalVeMezoWei: bigint;
  uniqueClaimants: number;
  source: "subgraph" | "rpc" | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

const hookState: { value: HookResult } = {
  value: {
    epochs: [],
    totalVeMezoWei: 0n,
    uniqueClaimants: 0,
    source: "rpc",
    isLoading: false,
    isError: false,
    error: null,
  },
};

vi.mock("@/hooks/useProtocolYieldHistory", () => ({
  useProtocolYieldHistory: () => hookState.value,
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

describe("<ProtocolEarningsChart />", () => {
  beforeEach(() => {
    walletReadyState.value = true;
    hookState.value = {
      epochs: makeContiguous([0n, 0n, 1n * 10n ** 18n, 2n * 10n ** 18n, 0n, 3n * 10n ** 18n, 4n * 10n ** 18n, 5n * 10n ** 18n]),
      totalVeMezoWei: 20_000_000n * 10n ** 18n,
      uniqueClaimants: 12,
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

  it("Given aggregated claim data, When rendered, Then it shows the chart with MUSD totals", () => {
    render(<ProtocolEarningsChart />);
    expect(screen.getByTestId("protocol-chart")).toBeInTheDocument();
    expect(
      screen.getByTestId("protocol-chart-currency-label").textContent,
    ).toMatch(/MUSD/);
  });

  it("Given no claim events on chain, When rendered, Then it shows the empty-state copy", () => {
    hookState.value = {
      ...hookState.value,
      epochs: [],
      uniqueClaimants: 0,
    };
    render(<ProtocolEarningsChart />);
    expect(
      screen.getByText(/no claims yet/i),
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
      isError: true,
      error: new Error("indexer 503"),
    };
    render(<ProtocolEarningsChart />);
    expect(screen.getByText(/indexer 503/i)).toBeInTheDocument();
  });
});
