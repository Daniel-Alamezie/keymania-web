'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether this player is mid-game, readable from anywhere.
 *
 * The arena knows the answer and the heartbeat needs it, but after the invite
 * toast moved above the page tree the two are no longer in the same component
 * — the heartbeat now lives in the layout so an invite can reach somebody
 * reading the leaderboard, and the arena is one page inside it.
 *
 * A module-level store rather than a context, for the same reason the account
 * hint is one: this is a single boolean with one writer, and threading a
 * provider through the tree to carry it would be more machinery than the fact
 * deserves.
 */

let busy = false;
const listeners = new Set<() => void>();

export function setBusy(value: boolean): void {
  if (busy === value) return;
  busy = value;
  listeners.forEach((notify) => notify());
}

export function useBusy(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => { listeners.delete(notify); };
    },
    () => busy,
    // Nothing is in a game during a server render, and claiming otherwise
    // would suppress the toast for the first paint after every navigation.
    () => false,
  );
}
