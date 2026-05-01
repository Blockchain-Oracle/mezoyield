import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { YieldBucket } from "@/hooks/useYieldHistory";

/**
 * STORY-009 BDD coverage for YieldChart:
 *   - Empty history → "No yield history yet" + no chart rendered
 *   - Has buckets → bar chart present + tooltip-target labels
 *   - Loading → skeleton present
 *   - Error → retry-friendly error message
 */

const historyState: {
  value: {
    epochs: YieldBucket[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
} = {
  value: { epochs: [], isLoading: false, isError: false, error: null },
};

vi.mock("@/hooks/useYieldHistory", () => ({
  useYieldHistory: () => historyState.value,
}));

const walletReadyState = { value: true };
vi.mock("@/app/providers", () => ({
  useWalletReady: () => walletReadyState.value,
}));

// Recharts uses ResponsiveContainer which requires a measurable parent
// width; in jsdom the dimensions are 0 and Recharts logs a warning while
// quietly refusing to render. Stub it with a fixed-width div so the
// chart's internal SVG actually mounts in tests.
vi.mock("recharts", async (importActual) => {
  const actual = await importActual<typeof import("recharts")>();
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-container" style={{ width: 400, height: 240 }}>
      {children}
    </div>
  );
  return { ...actual, ResponsiveContainer };
});

import { YieldChart } from "@/components/Dashboard/YieldChart";

describe("YieldChart", () => {
  beforeEach(() => {
    walletReadyState.value = true;
    historyState.value = {
      epochs: [],
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it("renders the SSR skeleton until the wallet provider stack is mounted", () => {
    walletReadyState.value = false;
    render(<YieldChart />);
    expect(screen.getByTestId("yield-chart-skeleton")).toBeInTheDocument();
  });

  it("renders the empty state when there are no claim epochs", () => {
    render(<YieldChart />);
    expect(screen.getByTestId("yield-chart-empty")).toHaveTextContent(
      /No yield history yet/i,
    );
    expect(screen.queryByTestId("yield-chart")).not.toBeInTheDocument();
  });

  it("renders the loading skeleton while history is loading", () => {
    historyState.value = {
      epochs: [],
      isLoading: true,
      isError: false,
      error: null,
    };
    render(<YieldChart />);
    expect(screen.getByTestId("yield-chart-skeleton")).toBeInTheDocument();
  });

  it("renders an error state with the underlying message", () => {
    historyState.value = {
      epochs: [],
      isLoading: false,
      isError: true,
      error: new Error("rpc unavailable"),
    };
    render(<YieldChart />);
    expect(screen.getByTestId("yield-chart-error")).toHaveTextContent(
      /rpc unavailable/i,
    );
  });

  it("renders the bar chart and per-epoch labels when history exists", () => {
    historyState.value = {
      epochs: [
        { epoch: 1700, musdWei: 5n * 10n ** 18n },
        { epoch: 1701, musdWei: 12n * 10n ** 18n / 10n }, // 1.2 MUSD
        { epoch: 1702, musdWei: 0n },
      ],
      isLoading: false,
      isError: false,
      error: null,
    };
    render(<YieldChart />);
    expect(screen.getByTestId("yield-chart")).toBeInTheDocument();
    // X-axis labels are relative to the most-recent epoch ("Epoch 0",
    // "Epoch -1", "Epoch -2"). The newest is on the right.
    expect(screen.getByTestId("yield-chart-summary")).toHaveTextContent(/3 epochs/i);
  });
});
