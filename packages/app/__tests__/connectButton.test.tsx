import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectButtonClient } from "@/components/ConnectButtonClient";

// We mock RainbowKit's ConnectButton.Custom so we can drive each render-prop
// state (disconnected vs connected) without spinning up the full wagmi/wallet
// stack. STORY-002 BDD: when wallet is connected, the header shows my
// truncated address.

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (state: unknown) => unknown }) =>
      // The state object is provided by each test via the wrapper below.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      children((globalThis as any).__rkState),
  },
}));

function setRainbowKitState(state: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__rkState = state;
}

describe("ConnectButtonClient", () => {
  it("shows the Connect CTA when the wallet is disconnected", () => {
    setRainbowKitState({
      account: undefined,
      chain: undefined,
      openConnectModal: () => {},
      openAccountModal: () => {},
      mounted: true,
    });
    render(<ConnectButtonClient />);
    expect(
      screen.getByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
  });

  it("shows the truncated address when the wallet is connected", () => {
    setRainbowKitState({
      account: { address: "0xABCDEF0123", displayName: "0xABCD…0123" },
      chain: { id: 31611, name: "Mezo Testnet", unsupported: false },
      openConnectModal: () => {},
      openAccountModal: () => {},
      mounted: true,
    });
    render(<ConnectButtonClient />);
    const addr = screen.getByTestId("connected-address");
    expect(addr).toHaveTextContent("0xABCD…0123");
  });
});
