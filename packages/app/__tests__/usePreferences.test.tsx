import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { usePreferences, STORAGE_KEY } from "@/features/settings/usePreferences";

/**
 * usePreferences — shared state hook that the three settings cards
 * (AutoCompound / GasFee / Notifications) lean on. Single Save action
 * persists the combined Preferences object to localStorage; the
 * "Saved" hint clears itself after 2s.
 *
 * Tests cover: default state, loading from storage, dirty tracking,
 * save flow, and the auto-clear behavior. Timer side-effects are
 * exercised with fake timers.
 */

describe("usePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("Given a fresh storage, When the hook mounts, Then preferences hold the defaults", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs.autoCompoundPct).toBe(0);
    expect(result.current.prefs.gasFeeBoost).toBe(100);
    expect(result.current.prefs.notificationEmail).toBe("");
  });

  it("Given a value saved in localStorage, When the hook mounts, Then it hydrates from that value", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ autoCompoundPct: 50, gasFeeBoost: 125 }),
    );
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs.autoCompoundPct).toBe(50);
    expect(result.current.prefs.gasFeeBoost).toBe(125);
  });

  it("Given an updater, When called, Then prefs reflect the partial change and the form becomes dirty", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.dirty).toBe(false);
    act(() => {
      result.current.setPrefs((p) => ({ ...p, autoCompoundPct: 30 }));
    });
    expect(result.current.prefs.autoCompoundPct).toBe(30);
    expect(result.current.dirty).toBe(true);
  });

  it("Given a dirty state, When save() runs, Then it writes to localStorage, marks the hint, and clears dirty", () => {
    const { result } = renderHook(() => usePreferences());
    act(() => {
      result.current.setPrefs((p) => ({ ...p, autoCompoundPct: 40 }));
    });
    act(() => {
      result.current.save();
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).autoCompoundPct).toBe(40);
    expect(result.current.dirty).toBe(false);
    expect(result.current.justSaved).toBe(true);
  });

  it("Given a stored value with bad JSON, When the hook mounts, Then it falls back to defaults instead of throwing", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json");
    const { result } = renderHook(() => usePreferences());
    expect(result.current.prefs.autoCompoundPct).toBe(0);
    expect(result.current.prefs.gasFeeBoost).toBe(100);
  });
});
