import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders the Dashboard panel content by default", () => {
    renderApp();
    expect(screen.getByTestId("dashboard-panel")).toHaveTextContent(
      /gauges, position, and yield/i,
    );
  });
});
