import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * AppHeader is the persistent top app-shell bar — appears on both the
 * landing (thin variant) and inside /app/* (full variant). Owns the
 * wordmark, nav, theme toggle and wallet/CTA slot. Must render
 * without a wagmi provider mounted (children gate independently on
 * useWalletReady) so it works during SSR.
 */

// Mock next-themes so the inline theme toggle (rendered when no override
// is provided) doesn't blow up under jsdom — useTheme requires a provider.
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: () => {}, resolvedTheme: "dark" }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub the wallet-ready hook so the wallet slot resolves predictably.
vi.mock("@/app/providers", () => ({
  useWalletReady: () => false,
}));

import { AppHeader } from "@/components/AppHeader/AppHeader";

describe("<AppHeader />", () => {
  it("Given the full variant, When rendered, Then the wordmark is visible", () => {
    render(<AppHeader variant="full" />);
    // Wordmark splits "Mezo" + "Yield" across two spans so the accent
    // colour can land on the second half. The "MezoYield home" aria-label
    // pins the wordmark Link regardless of internal markup.
    expect(
      screen.getByRole("link", { name: /mezoyield home/i }),
    ).toBeInTheDocument();
  });

  it("Given the full variant, When rendered, Then the primary nav items are visible", () => {
    render(<AppHeader variant="full" />);
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /strategies/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gauges/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /docs/i })).toBeInTheDocument();
  });

  it("Given the landing variant, When rendered, Then it shows a Launch app CTA and Docs link", () => {
    render(<AppHeader variant="landing" />);
    expect(screen.getByRole("link", { name: /launch app/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /docs/i })).toBeInTheDocument();
  });

  it("Given the landing variant, When rendered, Then it does NOT render the full dashboard nav", () => {
    render(<AppHeader variant="landing" />);
    expect(
      screen.queryByRole("link", { name: /^gauges$/i }),
    ).not.toBeInTheDocument();
  });

  it("Given any variant, When rendered, Then the theme toggle button is present", () => {
    render(<AppHeader variant="full" />);
    expect(
      screen.getByRole("button", { name: /toggle theme/i }),
    ).toBeInTheDocument();
  });
});
