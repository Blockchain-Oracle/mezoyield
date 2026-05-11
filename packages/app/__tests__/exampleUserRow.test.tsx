import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The reverse-empty-state preview row that occupies the dashboard
 * pre-wallet-connect. It must:
 *
 *   - Be a pure presentational component (no wagmi hooks).
 *   - Render static "example" values from props with sensible defaults.
 *   - Surface an explicit "example" label so a human/§14-reviewer can
 *     tell it apart from real on-chain data at a glance.
 */

import {
  ExampleUserRow,
  EXAMPLE_USER,
} from "@/features/dashboard/ExampleUserRow";

describe("<ExampleUserRow />", () => {
  it("Given default props, When rendered, Then it shows the strategy, veMEZO, and projected MUSD/wk", () => {
    render(<ExampleUserRow />);
    expect(screen.getByText(/Set & Forget/i)).toBeInTheDocument();
    expect(screen.getByText(/18\.42 veMEZO/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.14 MUSD\/wk/i)).toBeInTheDocument();
  });

  it("Given default props, When rendered, Then it surfaces an explicit 'example' label so it can't be mistaken for real data", () => {
    render(<ExampleUserRow />);
    // The literal string "example" must be present in the DOM.
    expect(screen.getAllByText(/example/i).length).toBeGreaterThan(0);
  });

  it("Given the EXAMPLE_USER constant, Then its values are stable and not derived from on-chain hooks", () => {
    // These values exist in code so future Codex-pass reviewers can
    // grep them and confirm no hook is wired underneath. The test pins
    // the literal values that show on screen.
    expect(EXAMPLE_USER.strategy).toBe("Set & Forget");
    expect(EXAMPLE_USER.veMezo).toBe(18.42);
    expect(EXAMPLE_USER.musdPerWeek).toBe(0.14);
  });
});
