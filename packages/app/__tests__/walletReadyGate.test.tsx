import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Toggle this to drive the gate — `useWalletReady` reads it on every render.
const walletReadyState = { value: false };

vi.mock("@/app/providers", () => ({
  useWalletReady: () => walletReadyState.value,
}));

// Force `next/dynamic` to return a clearly-identifiable client component so
// we can detect whether ConnectButton tried to mount it. If the gate works,
// this should never render while ready=false.
vi.mock("next/dynamic", () => ({
  default: () => function ClientStub() {
    return <span data-testid="client-stub">should-not-render-when-not-ready</span>;
  },
}));

import { ConnectButton } from "@/components/ConnectButton";

describe("ConnectButton wallet-readiness gate", () => {
  beforeEach(() => {
    walletReadyState.value = false;
  });

  it("renders the skeleton (not the wallet-using inner client) while wallet is not ready", () => {
    walletReadyState.value = false;
    render(<ConnectButton />);
    expect(screen.queryByTestId("client-stub")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect/i }),
    ).toBeDisabled();
  });

  it("mounts the inner client component once wallet is ready", () => {
    walletReadyState.value = true;
    render(<ConnectButton />);
    expect(screen.getByTestId("client-stub")).toBeInTheDocument();
  });
});
