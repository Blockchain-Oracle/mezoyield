import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSortableRows } from "@/hooks/useSortableRows";

interface Row {
  name: string;
  totalWei: bigint;
  apy: number | null;
}

const ONE = 10n ** 18n;
const rows: Row[] = [
  { name: "alpha", totalWei: 1_000_000n * ONE, apy: 5.2 },
  { name: "beta", totalWei: 250n * ONE, apy: null },
  { name: "gamma", totalWei: 10_000n * ONE, apy: 12.4 },
  { name: "delta", totalWei: 0n, apy: 0 },
];

describe("useSortableRows", () => {
  it("sorts by bigint key descending by default", () => {
    const { result } = renderHook(() =>
      useSortableRows<Row>(rows, "totalWei", "desc"),
    );
    expect(result.current.sorted.map((r) => r.name)).toEqual([
      "alpha",
      "gamma",
      "beta",
      "delta",
    ]);
  });

  it("toggle on same key flips direction (desc → asc)", () => {
    const { result } = renderHook(() =>
      useSortableRows<Row>(rows, "totalWei", "desc"),
    );
    act(() => result.current.toggle("totalWei"));
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.sorted.map((r) => r.name)).toEqual([
      "delta",
      "beta",
      "gamma",
      "alpha",
    ]);
  });

  it("toggle on a different key switches key, resets to defaultDir", () => {
    const { result } = renderHook(() =>
      useSortableRows<Row>(rows, "totalWei", "desc"),
    );
    act(() => result.current.toggle("name"));
    expect(result.current.sortKey).toBe("name");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.sorted.map((r) => r.name)).toEqual([
      "gamma",
      "delta",
      "beta",
      "alpha",
    ]);
  });

  it("nulls sort LAST regardless of direction", () => {
    const { result } = renderHook(() =>
      useSortableRows<Row>(rows, "apy", "desc"),
    );
    expect(result.current.sorted[result.current.sorted.length - 1]!.apy).toBeNull();
    act(() => result.current.toggle("apy"));
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.sorted[result.current.sorted.length - 1]!.apy).toBeNull();
  });
});
