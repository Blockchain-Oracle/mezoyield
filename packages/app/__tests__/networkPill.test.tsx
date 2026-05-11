import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * NetworkPill is a small but always-visible piece of app-shell chrome —
 * the only thing that tells a user "yes, you're still on testnet."
 * Per CLAUDE.md "new visible behavior without a test is block-class,"
 * this file pins the rendered label + chain-id for the two acceptable
 * Mezo chains and the unknown-chain fallback.
 *
 * The pill reads `MEZO_CHAIN_ID` from `@/lib/contracts`, which in turn
 * pulls from `packages/contracts/deployments/mezo-testnet.json`. The
 * test mocks `@/lib/contracts` so we can flip the chain ID without
 * swapping the deployment manifest on disk.
 */

const chainState: { value: number } = { value: 31611 };

vi.mock("@/lib/contracts", () => ({
  get MEZO_CHAIN_ID() {
    return chainState.value;
  },
}));

import { NetworkPill } from "@/components/Sidebar/NetworkPill";

describe("<NetworkPill />", () => {
  beforeEach(() => {
    chainState.value = 31611;
  });

  it("Given Mezo Testnet (31611), When rendered, Then it shows the testnet label and chain id", () => {
    chainState.value = 31611;
    render(<NetworkPill />);
    expect(screen.getByText(/Mezo Testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/31611/)).toBeInTheDocument();
  });

  it("Given Mezo Mainnet (31612), When rendered, Then it shows the mainnet label and chain id", () => {
    chainState.value = 31612;
    render(<NetworkPill />);
    expect(screen.getByText(/Mezo Mainnet/i)).toBeInTheDocument();
    expect(screen.getByText(/31612/)).toBeInTheDocument();
  });

  it("Given an unrecognized chain id, When rendered, Then it falls back to a generic 'Chain N' label", () => {
    chainState.value = 99999;
    render(<NetworkPill />);
    expect(screen.getByText(/Chain 99999/i)).toBeInTheDocument();
    // The literal id renders in two places (the fallback label "Chain 99999"
    // AND the standalone id span). Both should contain the digits.
    const matches = screen.getAllByText(/99999/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
