import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathState: { value: string } = { value: "/app/earn/strategies" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.value,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SubNav } from "@/components/chrome/SubNav";

const items = [
  { label: "Strategies", href: "/app/earn/strategies" },
  { label: "Gauges", href: "/app/earn/gauges" },
  { label: "My Vault", href: "/app/earn/vault" },
] as const;

describe("<SubNav />", () => {
  it("marks the item whose href matches the current pathname as active (aria-current=page)", () => {
    pathState.value = "/app/earn/strategies";
    render(<SubNav items={items} />);
    const active = screen.getByRole("link", { name: "Strategies" });
    expect(active.getAttribute("aria-current")).toBe("page");
    const inactive = screen.getByRole("link", { name: "Gauges" });
    expect(inactive.getAttribute("aria-current")).toBeNull();
  });

  it("treats nested paths as active for their parent item (e.g. /strategies/manual)", () => {
    pathState.value = "/app/earn/gauges/manual";
    render(<SubNav items={items} />);
    expect(
      screen.getByRole("link", { name: "Gauges" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("renders zero active items when path does not match any item", () => {
    pathState.value = "/app/dashboard";
    render(<SubNav items={items} />);
    const active = items
      .map((i) =>
        screen.getByRole("link", { name: i.label }).getAttribute("aria-current"),
      )
      .filter((v) => v === "page");
    expect(active.length).toBe(0);
  });
});
