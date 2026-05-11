import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { GasFeeCard } from "@/features/settings/GasFeeCard";

/**
 * GasFeeCard — Boar-style card with UPPERCASE GAS-FEE BOOST title,
 * COMING NEXT amber pill, big-metric showing the current %, and a
 * 4-segment bar mirroring the preset (100/110/125/150 → seg 1..4).
 */

function renderCard(
  props: Partial<React.ComponentProps<typeof GasFeeCard>> = {},
) {
  const noop = () => {};
  return render(
    <GasFeeCard
      boost={props.boost ?? 100}
      onChange={props.onChange ?? noop}
      onSave={props.onSave ?? noop}
      dirty={props.dirty ?? false}
      justSaved={props.justSaved ?? false}
    />,
  );
}

describe("<GasFeeCard />", () => {
  it("Given the default 100% boost, When rendered, Then the title, COMING NEXT pill, and 100% metric are visible", () => {
    renderCard({ boost: 100 });
    expect(screen.getByText(/GAS-FEE BOOST/i)).toBeInTheDocument();
    expect(screen.getByText(/COMING NEXT/i)).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it("Given boost=125, When rendered, Then the bar has 3 of 4 filled", () => {
    renderCard({ boost: 125 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
  });

  it("Given a preset button click, When 150 is clicked, Then onChange fires with 150", () => {
    let received = 0;
    renderCard({
      onChange: (next) => {
        received = next;
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "150%" }));
    expect(received).toBe(150);
  });

  it("Given a segment click on the 2nd segment, When clicked, Then onChange fires with 110", () => {
    let received = 0;
    renderCard({
      onChange: (next) => {
        received = next;
      },
    });
    const segments = screen.getAllByRole("button", {
      name: /Set gas-fee boost/i,
    });
    fireEvent.click(segments[1]);
    expect(received).toBe(110);
  });

  it("Given dirty=true, When rendered, Then the Save preferences CTA shows", () => {
    renderCard({ dirty: true });
    expect(
      screen.getByRole("button", { name: /Save preferences/i }),
    ).toBeInTheDocument();
  });
});
