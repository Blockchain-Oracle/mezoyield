"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared settings-state hook for the three Boar-style settings cards.
 *
 * The three settings cards (AutoCompound, GasFee, Notifications) all
 * read from and write into the same Preferences blob, with one Save
 * action that persists the combined state to localStorage.
 *
 * Important: `dirty` is tracked against the last *saved* snapshot, not
 * against the defaults — so reopening the page after a save shows a
 * clean form, and toggling a value then toggling it back also clears
 * dirty.
 *
 * The "Saved" hint (`justSaved`) auto-clears after `SAVED_HINT_MS`.
 */

export const STORAGE_KEY = "mezoyield:settings:v1";
export const SAVED_HINT_MS = 2000;

export type GasFeeBoost = 100 | 110 | 125 | 150;

export type Preferences = {
  /**
   * % of claimed MUSD to auto-compound into MEZO via Tigris swap +
   * re-lock as veMEZO. 0 = never.
   */
  autoCompoundPct: number;
  /** Default gas-fee multiplier when submitting a vote. */
  gasFeeBoost: GasFeeBoost;
  /** Optional notification email — Phase 8 polish, not wired yet. */
  notificationEmail: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  autoCompoundPct: 0,
  gasFeeBoost: 100,
  notificationEmail: "",
};

function clampPct(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeBoost(n: unknown): GasFeeBoost {
  const allowed: GasFeeBoost[] = [100, 110, 125, 150];
  return (allowed.includes(n as GasFeeBoost) ? n : 100) as GasFeeBoost;
}

function normalize(partial: Partial<Preferences>): Preferences {
  return {
    autoCompoundPct: clampPct(partial.autoCompoundPct),
    gasFeeBoost: normalizeBoost(partial.gasFeeBoost),
    notificationEmail:
      typeof partial.notificationEmail === "string"
        ? partial.notificationEmail
        : "",
  };
}

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    // localStorage can throw in private/Safari modes or when disabled.
    // Codex P1: never swallow silently — surface the reason so a dev
    // noticing "my settings don't persist" can find this in console.
    console.warn("[usePreferences] localStorage read failed:", err);
    return DEFAULT_PREFERENCES;
  }
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return normalize({ ...DEFAULT_PREFERENCES, ...parsed });
  } catch (err) {
    // Corrupted JSON — log so the user-visible "reset to defaults" is
    // not invisible. Returning defaults is the right recovery: a stale
    // bad blob shouldn't permanently block the settings UI.
    console.warn("[usePreferences] could not parse stored prefs:", err);
    return DEFAULT_PREFERENCES;
  }
}

function persist(p: Preferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch (err) {
    // QuotaExceeded / private-mode write block — must not crash the
    // save flow, but must not be invisible either.
    console.warn("[usePreferences] localStorage write failed:", err);
  }
}

function equal(a: Preferences, b: Preferences): boolean {
  return (
    a.autoCompoundPct === b.autoCompoundPct &&
    a.gasFeeBoost === b.gasFeeBoost &&
    a.notificationEmail === b.notificationEmail
  );
}

export type UsePreferences = {
  prefs: Preferences;
  setPrefs: (updater: (p: Preferences) => Preferences) => void;
  save: () => void;
  /** True when current prefs differ from the last saved snapshot. */
  dirty: boolean;
  /** True for ~2s after a successful save, drives the "Saved" hint. */
  justSaved: boolean;
};

export function usePreferences(): UsePreferences {
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const lastSavedRef = useRef<Preferences>(DEFAULT_PREFERENCES);

  // Load on mount.
  useEffect(() => {
    const loaded = loadPrefs();
    setPrefsState(loaded);
    lastSavedRef.current = loaded;
  }, []);

  // Auto-clear the "Saved" hint.
  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), SAVED_HINT_MS);
    return () => clearTimeout(t);
  }, [savedAt]);

  const setPrefs = useCallback(
    (updater: (p: Preferences) => Preferences) => {
      setPrefsState((prev) => updater(prev));
    },
    [],
  );

  const save = useCallback(() => {
    setPrefsState((current) => {
      persist(current);
      lastSavedRef.current = current;
      setSavedAt(Date.now());
      return current;
    });
  }, []);

  const dirty = !equal(prefs, lastSavedRef.current);

  return {
    prefs,
    setPrefs,
    save,
    dirty,
    justSaved: savedAt !== null,
  };
}
