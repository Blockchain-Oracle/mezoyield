import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The /docs route is a public static page — judges and external readers
 * land here without connecting a wallet. Therefore it MUST NOT call
 * any wagmi hooks; rendering should succeed without mocking wagmi.
 *
 * Required sections:
 *   - Intro
 *   - How the optimizer scores gauges (with the formula)
 *   - FAQ (6 entries)
 *   - Contracts table with explorer links
 *   - Non-custody disclosure
 *   - Risk disclaimer
 */

import DocsPage from "@/app/docs/page";

describe("/docs page", () => {
  it("Given the page is rendered, Then it surfaces all six top-level sections", () => {
    render(<DocsPage />);
    expect(screen.getByRole("heading", { name: /docs/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /how the optimizer scores gauges/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /faq/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /contracts/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /non-custody/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /risk/i })).toBeInTheDocument();
  });

  it("Given the FAQ section, Then it contains exactly 6 question entries", () => {
    render(<DocsPage />);
    // FAQ rows expose a data-testid so we can count without coupling to
    // markup choice (dl/dt, details/summary, h3+p, etc).
    const items = screen.getAllByTestId("docs-faq-item");
    expect(items).toHaveLength(6);
  });

  it("Given the contracts table, Then each row links to the Mezo testnet explorer at /address/<addr>", () => {
    render(<DocsPage />);
    const rows = screen.getAllByTestId("docs-contract-row");
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      const link = row.querySelector("a[href*='explorer.test.mezo.org/address/']");
      expect(link).not.toBeNull();
    }
  });

  it("Given the optimizer-scoring section, Then the bribe/totalVeMezo formula is named", () => {
    render(<DocsPage />);
    // The score = bribe / totalVeMezo line. Codex P2: this paragraph
    // exists so judges can trace the public claim back to lib/optimize.ts.
    expect(
      screen.getByText(/bribe.*total.*veMezo|score.*=.*bribe/i),
    ).toBeInTheDocument();
  });
});
