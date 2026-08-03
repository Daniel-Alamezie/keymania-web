'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { ARENA_FX, asFx, DEFAULT_FX, nextFx, type ArenaFx, type FxId } from './arenaFx';

export interface ArenaFxControl {
  fx: ArenaFx;
  /**
   * Whether a preset was asked for by URL.
   *
   * Drives whether the switcher is on screen at all, which is how a normal
   * player never learns this exists: no `?fx=`, no badge, and the control preset
   * is today's arena exactly.
   */
  testing: boolean;
  cycle: (step?: 1 | -1) => void;
  set: (id: FxId) => void;
}

/** The key that walks the presets. Not a character, so it cannot be typed. */
const CYCLE_KEY = 'F2';

/*
 * The URL is the state.
 *
 * Not a `useState` synced from `window.location` in an effect, which was the
 * first attempt and wrong twice over. It duplicates the truth, so the address bar
 * and the screen can disagree; and reading the query string during render to
 * avoid that produces different markup on the server, where there is no query
 * string, than on the client. Keeping the URL as the only copy means a tester can
 * always paste the address of the thing they just liked.
 *
 * `useSyncExternalStore` is the sanctioned way to read something the browser owns:
 * the server snapshot answers "the control", the client snapshot reads the real
 * URL, and React reconciles the two without a hydration mismatch.
 */
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Back and forward buttons change the query string without going through us.
  window.addEventListener('popstate', notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('popstate', notify);
  };
}

const announce = () => listeners.forEach((notify) => notify());

const param = () => new URLSearchParams(window.location.search).get('fx');

/**
 * `?flash=` on its own, overriding whichever preset is running.
 *
 * Its own parameter rather than another preset, because the question is
 * independent of the others: "does the white flash need toning down" has nothing
 * to do with which layout is on screen, and folding it into the preset list
 * would mean comparing two things at once and learning about neither.
 *
 * Absent means the preset decides, so a normal player is untouched.
 */
const FLASHES = ['full', 'heavy', 'taken', 'edge', 'none'] as const;
export type FlashMode = (typeof FLASHES)[number];

const readFlash = (): FlashMode | null => {
  const asked = new URLSearchParams(window.location.search).get('flash');
  return FLASHES.includes(asked as FlashMode) ? (asked as FlashMode) : null;
};

/**
 * The saved preference, for players who chose a layout in Settings.
 *
 * The URL still wins where it is present, and that ordering is the point: the
 * query string is a tester's override and has to beat a stored preference, or
 * `?fx=stage` would silently show somebody their own saved choice instead.
 * Absent from both, the default stands — which is what a new player gets, and
 * why the default must never be changed by this file.
 */
const PREF_KEY = 'keymania.arena';

const readSaved = (): FxId | null => {
  try {
    const saved = localStorage.getItem(PREF_KEY);
    // Validated, not trusted: a preset retired in a later release must leave
    // the player on the default rather than on a layout that no longer exists.
    return saved && saved === asFx(saved) ? asFx(saved) : null;
  } catch {
    return null;
  }
};

const readId = (): FxId => (param() !== null ? asFx(param()) : readSaved() ?? DEFAULT_FX);
const readTesting = () => param() !== null;

/**
 * Remember a chosen layout, and keep the URL honest while testing.
 *
 * Writes the preference always and the query string only when one is already
 * there — so a tester's address bar keeps matching what they see and stays
 * pasteable, while an ordinary player's URL is never decorated by opening
 * Settings.
 */
function write(id: FxId) {
  try {
    localStorage.setItem(PREF_KEY, id);
  } catch {
    /* private mode — the choice lasts the visit */
  }
  if (param() !== null) {
    const url = new URL(window.location.href);
    url.searchParams.set('fx', id);
    window.history.replaceState(null, '', url);
  }
  announce();
}

/**
 * Which arena treatment is running, and how to change it mid-duel.
 *
 * A temporary harness for choosing between the de-clutter options in
 * `arenaFx.ts`. Everything about it is inert without `?fx=` in the URL.
 */
export function useArenaFx(): ArenaFxControl {
  // Primitives, so referential stability costs nothing and no snapshot cache is
  // needed. Two subscriptions to the same store rather than one object.
  // The server has no query string, so it renders what an absent one means.
  const id = useSyncExternalStore(subscribe, readId, () => DEFAULT_FX);
  const testing = useSyncExternalStore(subscribe, readTesting, () => false);
  const flash = useSyncExternalStore(subscribe, readFlash, () => null);

  const set = useCallback((next: FxId) => write(next), []);
  const cycle = useCallback((step: 1 | -1 = 1) => write(nextFx(readId(), step)), []);

  /**
   * The hotkey, live only while testing.
   *
   * F2 rather than a letter because every letter belongs to the duel, and a
   * function key never reaches the word being typed. Bound in capture so it
   * beats the game's own key handling; Shift walks backwards.
   */
  useEffect(() => {
    if (!testing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== CYCLE_KEY) return;
      e.preventDefault();
      cycle(e.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [testing, cycle]);

  /**
   * Memoised, because this is a fresh object whenever the override is present
   * and `fx` is in the dependency list of effects that must not re-run — one of
   * them re-applies a blade that has already landed.
   */
  const fx = useMemo(
    () => (flash ? { ...ARENA_FX[id], flash } : ARENA_FX[id]),
    [id, flash],
  );

  return { fx, testing, cycle, set };
}
