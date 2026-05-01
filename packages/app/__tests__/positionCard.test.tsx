import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Gauge } from "@/lib/types";

/**
 * STORY-006 BDD coverage for PositionCard:
 *   - Wallet not connected → "Connect wallet to see your position"
 *   - Wallet connected → veMEZO balance in human-readable format
 *   - Allocation present → "Allocated: X gauges" summary
 *   - Hero MUSD/week derived from allocation × gauge bribes (PRD framing
 *     extension; non-BDD-required but PR-justified)
 */

const veMezoState: { value: { balanceWei: bigint; allocation: Array<{ gauge: string; weightBps: number }>; isConnected: boolean; isLoading: boolean } } = {
  value: { balanceWei: 0n, allocation: [], isConnected: false, isLoading: false },
};
const gaugeDataState: { value: { gauges: Gauge[] | undefined } } = { value: { gauges: [] } };
const walletReadyState = { value: true };
const accountState: { value: { address?: `0x${string}` } } = { value: {} };

vi.mock("@/hooks/useVeMezoPosition", () => ({
  useVeMezoPosition: () => veMezoState.value,
}));
vi.mock("@/hooks/useGaugeData", () => ({
  useGaugeData: () => ({
    ...gaugeDataState.value,
    isLoading: false,
    isError: false,
    error: null,
    source: "rpc",
    refetch: () => {},
  }),
}));
vi.mock("@/app/providers", () => ({
  useWalletReady: () => walletReadyState.value,
}));
vi.mock("wagmi", () => ({
  useAccount: () => accountState.value,
}));

import { PositionCard } from "@/components/Dashboard/PositionCard";

describe("PositionCard", () => {
  beforeEach(() => {
    walletReadyState.value = true;
    accountState.value = {};
    veMezoState.value = { balanceWei: 0n, allocation: [], isConnected: false, isLoading: false };
    gaugeDataState.value = { gauges: [] };
  });

  it("renders the skeleton while wallet providers haven't mounted", () => {
    walletReadyState.value = false;
    render(<PositionCard />);
    expect(screen.getByTestId("position-card-skeleton")).toBeInTheDocument();
  });

  it("renders the disconnected hint when no wallet is connected", () => {
    veMezoState.value = { balanceWei: 0n, allocation: [], isConnected: false, isLoading: false };
    render(<PositionCard />);
    expect(screen.getByTestId("position-card-disconnected")).toHaveTextContent(
      /Connect wallet/i,
    );
  });

  it("renders veMEZO balance + Allocated summary when connected with allocation", () => {
    const G1: `0x${string}` = "0xa000000000000000000000000000000000000001";
    veMezoState.value = {
      balanceWei: 1500n * 10n ** 18n,
      allocation: [{ gauge: G1, weightBps: 6000 }],
      isConnected: true,
      isLoading: false,
    };
    gaugeDataState.value = {
      gauges: [
        {
          address: G1,
          name: "Stability Pool",
          totalVeMezoWei: 1_000_000n * 10n ** 18n,
          bribeMUSDWei: 1_000n * 10n ** 18n,
          apyPercent: 5.2,
        },
      ],
    };
    render(<PositionCard />);
    const card = screen.getByTestId("position-card");
    expect(card).toHaveTextContent("1.50k veMEZO");
    expect(screen.getByTestId("position-card-allocated")).toHaveTextContent(
      "Allocated: 1 gauge",
    );
  });

  it("computes the MUSD/week hero from allocation × gauge bribes", () => {
    const G1: `0x${string}` = "0xa000000000000000000000000000000000000001";
    // user has 1500 veMEZO, 100% on G1.
    // G1 has totalVeMezo=1_000_000, bribe=1_000.
    // share = 1500 * 1.0 = 1500. reward = 1500 * 1000 / 1_000_000 = 1.5 MUSD/week.
    veMezoState.value = {
      balanceWei: 1500n * 10n ** 18n,
      allocation: [{ gauge: G1, weightBps: 10_000 }],
      isConnected: true,
      isLoading: false,
    };
    gaugeDataState.value = {
      gauges: [
        {
          address: G1,
          name: "G1",
          totalVeMezoWei: 1_000_000n * 10n ** 18n,
          bribeMUSDWei: 1_000n * 10n ** 18n,
          apyPercent: null,
        },
      ],
    };
    render(<PositionCard />);
    expect(screen.getByTestId("position-card-hero")).toHaveTextContent(
      "≈ 1.50 MUSD/week",
    );
  });
});
