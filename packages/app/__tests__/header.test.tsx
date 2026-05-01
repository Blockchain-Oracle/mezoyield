import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "@/components/Header";

describe("Header", () => {
  it("renders the MezoYield wordmark", () => {
    render(<Header tabs={null} connectSlot={null} />);
    expect(screen.getByText("MezoYield")).toBeInTheDocument();
  });

  it("renders the tabs slot content", () => {
    render(
      <Header
        tabs={<div data-testid="tabs-slot">tabs go here</div>}
        connectSlot={null}
      />,
    );
    expect(screen.getByTestId("tabs-slot")).toBeInTheDocument();
  });

  it("renders the connect slot content", () => {
    render(
      <Header
        tabs={null}
        connectSlot={<button>fake-connect</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "fake-connect" }),
    ).toBeInTheDocument();
  });
});
