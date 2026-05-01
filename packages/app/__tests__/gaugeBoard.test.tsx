import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Gauge } from "@/lib/types";

/**
 * GaugeBoard component states from story-005 BDD:
 *   - Loading skeleton during fetch
 *   - Populated table with name / APY / incentive / my-weight columns
 *   - Disconnected wallet → "my weight" cell shows "—"
 *   - Subgraph + RPC error → user-readable error + Retry button
 *   - Empty registry → "No active gauges this epoch."
 *
 * We mock `useGaugeData`, `useUserAllocation`, `useWalletReady`, and
 * `wagmi.useAccount` so the component is exercised in isolation. The
 * hooks themselves are pure-frontend coordination layers; their wagmi
 * call sites are covered indirectly by the testnet integration tests
 * under `packages/contracts/test/integration/`.
 */

type GaugeDataMock = {
  gauges: Gauge[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  source: "subgraph" | "rpc" | null;
  refetch: () => void;
};

const gaugeDataState: { value: GaugeDataMock } = {
  value: {
    gauges: undefined,
    isLoading: true,
    isError: false,
    error: null,
    source: null,
    refetch: vi.fn(),
  },
};

const userAllocationState: {
  value: {
    entries: Array<{ gauge: string; weightBps: number }>;
    isConnected: boolean;
    isLoading: boolean;
  };
} = {
  value: { entries: [], isConnected: false, isLoading: false },
};

const walletReadyState = { value: true };
const accountState: { value: { address?: `0x${string}` } } = { value: {} };

vi.mock("@/hooks/useGaugeData", () => ({
  useGaugeData: () => gaugeDataState.value,
}));
vi.mock("@/hooks/useUserAllocation", () => ({
  useUserAllocation: () => userAllocationState.value,
}));
vi.mock("@/app/providers", () => ({
  useWalletReady: () => walletReadyState.value,
}));
vi.mock("wagmi", () => ({
  useAccount: () => accountState.value,
}));

import { GaugeBoard } from "@/components/Dashboard/GaugeBoard";

describe("GaugeBoard", () => {
  beforeEach(() => {
    walletReadyState.value = true;
    accountState.value = {};
    userAllocationState.value = { entries: [], isConnected: false, isLoading: false };
    gaugeDataState.value = {
      gauges: undefined,
      isLoading: true,
      isError: false,
      error: null,
      source: null,
      refetch: vi.fn(),
    };
  });

  it("renders the skeleton while gauge data is loading", () => {
    render(<GaugeBoard />);
    expect(screen.getByTestId("gauge-board-skeleton")).toBeInTheDocument();
  });

  it("renders the skeleton while wallet providers haven't mounted", () => {
    walletReadyState.value = false;
    gaugeDataState.value = { ...gaugeDataState.value, isLoading: false, gauges: [] };
    render(<GaugeBoard />);
    expect(screen.getByTestId("gauge-board-skeleton")).toBeInTheDocument();
  });

  it("renders gauge rows with name / APY / incentive / my-weight columns", () => {
    const gauge: Gauge = {
      address: "0xd9f81562e57489c3615983cf4f55e0057971908c",
      name: "Stability Pool",
      totalVeMezoWei: 12_500_000n * 10n ** 18n,
      bribeMUSDWei: 8_400n * 10n ** 18n,
      apyPercent: 3.5,
    };
    gaugeDataState.value = {
      gauges: [gauge],
      isLoading: false,
      isError: false,
      error: null,
      source: "rpc",
      refetch: vi.fn(),
    };
    render(<GaugeBoard />);
    const row = screen.getByTestId(`gauge-row-${gauge.address}`);
    expect(row).toHaveTextContent("Stability Pool");
    expect(row).toHaveTextContent("3.5%");
  });

  it("shows '—' in the my-weight column when wallet is not connected", () => {
    const gauge: Gauge = {
      address: "0xabc0000000000000000000000000000000000001",
      name: "Test Gauge",
      totalVeMezoWei: 1n * 10n ** 18n,
      bribeMUSDWei: 1n * 10n ** 18n,
      apyPercent: 5_200.0,
    };
    gaugeDataState.value = {
      gauges: [gauge],
      isLoading: false,
      isError: false,
      error: null,
      source: "rpc",
      refetch: vi.fn(),
    };
    userAllocationState.value = { entries: [], isConnected: false, isLoading: false };
    render(<GaugeBoard />);
    const cell = screen.getByTestId(`gauge-row-${gauge.address}-myweight`);
    expect(cell).toHaveTextContent("—");
  });

  it("shows the user's weight % when connected and an allocation exists", () => {
    const gauge: Gauge = {
      address: "0xabc0000000000000000000000000000000000002",
      name: "Test Gauge",
      totalVeMezoWei: 1n * 10n ** 18n,
      bribeMUSDWei: 1n * 10n ** 18n,
      apyPercent: 5_200.0,
    };
    gaugeDataState.value = {
      gauges: [gauge],
      isLoading: false,
      isError: false,
      error: null,
      source: "rpc",
      refetch: vi.fn(),
    };
    userAllocationState.value = {
      entries: [{ gauge: gauge.address, weightBps: 4500 }],
      isConnected: true,
      isLoading: false,
    };
    render(<GaugeBoard />);
    const cell = screen.getByTestId(`gauge-row-${gauge.address}-myweight`);
    expect(cell).toHaveTextContent("45%");
  });

  it("renders the user-readable error state with a Retry button on subgraph+RPC failure", () => {
    const refetch = vi.fn();
    gaugeDataState.value = {
      gauges: undefined,
      isLoading: false,
      isError: true,
      error: new Error("network down"),
      source: null,
      refetch,
    };
    render(<GaugeBoard />);
    const errorBlock = screen.getByTestId("gauge-board-error");
    expect(errorBlock).toHaveTextContent(/Could not load gauge data/i);
    fireEvent.click(screen.getByTestId("gauge-board-retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state when the registry has no gauges", () => {
    gaugeDataState.value = {
      gauges: [],
      isLoading: false,
      isError: false,
      error: null,
      source: "rpc",
      refetch: vi.fn(),
    };
    render(<GaugeBoard />);
    expect(screen.getByTestId("gauge-board-empty")).toHaveTextContent(
      /no active gauges/i,
    );
  });
});
