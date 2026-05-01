import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "@/components/Providers";

describe("Providers", () => {
  it("renders children inside the wagmi/query/rainbowkit stack", () => {
    render(
      <Providers>
        <span data-testid="child">hello</span>
      </Providers>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });
});
