import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * ThemeToggle — a button that flips between light and dark via
 * next-themes' `setTheme`. Uses lucide-react Sun/Moon icons. Must:
 *
 *   1. Render nothing meaningful before `mounted` (next-themes SSR
 *      hydration dodge — server doesn't know the resolved theme).
 *   2. After mount, render an icon + aria-label.
 *   3. On click, call `setTheme("light")` when current is "dark" and
 *      vice versa.
 */

const setThemeMock = vi.fn();
let currentTheme: "light" | "dark" = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: currentTheme,
    resolvedTheme: currentTheme,
    setTheme: setThemeMock,
  }),
}));

import { ThemeToggle } from "@/components/AppHeader/ThemeToggle";

describe("<ThemeToggle />", () => {
  beforeEach(() => {
    setThemeMock.mockReset();
    currentTheme = "dark";
  });

  it("Given the toggle is rendered, Then a button with the toggle-theme label appears", () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: /toggle theme/i }),
    ).toBeInTheDocument();
  });

  it("Given the current theme is dark, When the toggle is clicked, Then setTheme is called with 'light'", () => {
    currentTheme = "dark";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    fireEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("Given the current theme is light, When the toggle is clicked, Then setTheme is called with 'dark'", () => {
    currentTheme = "light";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    fireEvent.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});
