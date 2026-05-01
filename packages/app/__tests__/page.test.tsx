import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import HomePage from "@/app/page";
import { Providers } from "@/components/Providers";

function renderApp() {
  return render(
    <Providers>
      <HomePage />
    </Providers>,
  );
}

describe("HomePage", () => {
  it("renders Dashboard and Optimize tab triggers", () => {
    renderApp();
    expect(
      screen.getByRole("tab", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Optimize" })).toBeInTheDocument();
  });

  it("renders the Dashboard panel by default", () => {
    renderApp();
    expect(screen.getByTestId("dashboard-panel")).toBeInTheDocument();
    // The panel mounts <GaugeBoard />; while wallet providers are still
    // hydrating in tests, GaugeBoard renders its skeleton placeholder.
    expect(screen.getByTestId("gauge-board-skeleton")).toBeInTheDocument();
  });

  it("switches to the Optimize panel when its tab is clicked", () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Optimize" }));
    expect(screen.getByTestId("optimize-panel")).toHaveTextContent(
      /choose your strategy/i,
    );
  });

  it("renders the Connect call-to-action in the header by default", () => {
    renderApp();
    // ConnectButton's loading skeleton — the dynamic({ssr:false}) loader —
    // also says "Connect" while the chunk loads. RainbowKit's mounted=false
    // path then takes over.
    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
  });
});
