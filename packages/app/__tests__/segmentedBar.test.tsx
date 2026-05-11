import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SegmentedBar } from "@/components/ui/segmented-bar";

/**
 * SegmentedBar — the Boar-style segmented progress strip used in the
 * settings cards. It is the visual control: a row of equal-width pill
 * segments where the first N are filled with the variant accent color
 * and the rest sit at a low-opacity ghost color. Exposes ARIA
 * `progressbar` semantics so screen readers + tests can read state
 * without poking implementation details.
 *
 * The component should never throw on bad input — clamp instead.
 */

describe("<SegmentedBar />", () => {
  it("Given value=3 max=5, When rendered, Then it renders 5 segments and marks 3 of them as filled", () => {
    render(<SegmentedBar value={3} max={5} />);
    const bar = screen.getByRole("progressbar");
    const segments = bar.querySelectorAll('[data-segment]');
    expect(segments.length).toBe(5);
    const filled = bar.querySelectorAll('[data-segment="filled"]');
    expect(filled.length).toBe(3);
  });

  it("Given value=0, When rendered, Then no segments are filled and aria-valuenow is 0", () => {
    render(<SegmentedBar value={0} max={5} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    const filled = bar.querySelectorAll('[data-segment="filled"]');
    expect(filled.length).toBe(0);
  });

  it("Given value=max, When rendered, Then all segments are filled", () => {
    render(<SegmentedBar value={5} max={5} />);
    const bar = screen.getByRole("progressbar");
    const filled = bar.querySelectorAll('[data-segment="filled"]');
    expect(filled.length).toBe(5);
    expect(bar.getAttribute("aria-valuenow")).toBe("5");
  });

  it("Given value greater than max, When rendered, Then it clamps to max instead of crashing", () => {
    render(<SegmentedBar value={99} max={5} />);
    const bar = screen.getByRole("progressbar");
    const filled = bar.querySelectorAll('[data-segment="filled"]');
    expect(filled.length).toBe(5);
    // aria-valuenow should report the clamped value, not the raw input
    expect(bar.getAttribute("aria-valuenow")).toBe("5");
  });

  it("Given a negative value, When rendered, Then it clamps to 0", () => {
    render(<SegmentedBar value={-3} max={5} />);
    const bar = screen.getByRole("progressbar");
    const filled = bar.querySelectorAll('[data-segment="filled"]');
    expect(filled.length).toBe(0);
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
  });

  it("Given accessibility attributes, Then it exposes role/min/max", () => {
    render(<SegmentedBar value={2} max={10} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
  });

  it("Given an onSelect handler, When a segment is clicked, Then it fires with the 1-based segment index", () => {
    let lastValue = -1;
    render(
      <SegmentedBar
        value={0}
        max={5}
        onSelect={(v) => {
          lastValue = v;
        }}
      />,
    );
    const bar = screen.getByRole("progressbar");
    const segments = bar.querySelectorAll<HTMLElement>('[data-segment]');
    segments[2].click();
    expect(lastValue).toBe(3);
  });
});
