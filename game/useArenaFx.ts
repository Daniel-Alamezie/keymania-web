'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { ARENA_FX, asFx, nextFx, type ArenaFx, type FxId } from './arenaFx';

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

const readId = (): FxId => asFx(param());
const readTesting = () => param() !== null;

/** Rewrites the query string in place, then tells every reader to look again. */
function write(id: FxId) {
  const url = new URL(window.location.href);
  url.searchParams.set('fx', id);
  window.history.replaceState(null, '', url);
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
  const id = useSyncExternalStore(subscribe, readId, () => 'current' as FxId);
  const testing = useSyncExternalStore(subscribe, readTesting, () => false);

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

  return { fx: ARENA_FX[id], testing, cycle, set };
}
