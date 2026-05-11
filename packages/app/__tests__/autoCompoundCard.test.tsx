import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AutoCompoundCard } from "@/features/settings/AutoCompoundCard";
import { STORAGE_KEY } from "@/features/settings/usePreferences";

/**
 * AutoCompoundCard — Boar-style card with UPPERCASE title, LIVE pill,
 * big metric, segmented bar of 10, and an inline status row. The
 * segmented bar IS the control: clicking a segment sets the percentage
 * in 10% increments.
 */

function renderCard(
  props: Partial<React.ComponentProps<typeof AutoCompoundCard>> = {},
) {
  const noop = () => {};
  return render(
    <AutoCompoundCard
      pct={props.pct ?? 0}
      onChange={props.onChange ?? noop}
      onSave={props.onSave ?? noop}
      dirty={props.dirty ?? false}
      justSaved={props.justSaved ?? false}
    />,
  );
}

describe("<AutoCompoundCard />", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("Given pct=0, When rendered, Then the title, LIVE pill, and 0% metric are visible", () => {
    renderCard({ pct: 0 });
    expect(screen.getByText(/AUTO-COMPOUND/i)).toBeInTheDocument();
    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("Given pct=50, When rendered, Then the segmented bar has 5 of 10 filled", () => {
    renderCard({ pct: 50 });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("5");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
  });

  it("Given pct=0, When the off-state status text renders, Then it says claims land in the wallet", () => {
    renderCard({ pct: 0 });
    expect(screen.getByText(/every MUSD claim/i)).toBeInTheDocument();
  });

  it("Given pct>0, When rendered, Then status text describes the destination", () => {
    renderCard({ pct: 40 });
    expect(screen.getByText(/Compounding 40%/i)).toBeInTheDocument();
  });

  it("Given a segment click, When index 3 is clicked, Then onChange fires with 30", () => {
    let received = -1;
    renderCard({
      pct: 0,
      onChange: (next) => {
        received = next;
      },
    });
    const segments = screen.getAllByRole("button", { name: /Set auto-compound/i });
    fireEvent.click(segments[2]);
    expect(received).toBe(30);
  });

  it("Given dirty=true, When rendered, Then the Save preferences CTA shows", () => {
    renderCard({ dirty: true });
    expect(
      screen.getByRole("button", { name: /Save preferences/i }),
    ).toBeInTheDocument();
  });

  it("Given justSaved=true and not dirty, When rendered, Then the Saved hint shows", () => {
    renderCard({ dirty: false, justSaved: true });
    expect(screen.getByText(/^Saved$/)).toBeInTheDocument();
  });

  it("Given the Show flow toggle, When clicked, Then the 3-step compound flow becomes visible", () => {
    renderCard({ pct: 50 });
    // Initially collapsed — the preview note should NOT be in the doc.
    expect(screen.queryByText(/Preview note/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show flow/i }));
    expect(screen.getByText(/Preview note/i)).toBeInTheDocument();
    // And the step ordering badge for step 1 should appear.
    expect(screen.getByText(/^1$/)).toBeInTheDocument();
  });
});
