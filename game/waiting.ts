'use client';

import { useSyncExternalStore } from 'react';

/**
 * The friend this player has asked for a game, if any.
 *
 * Lives outside the page tree for the same reason the toast does: the ask is
 * made from the friends list or a profile card, and the answer to it can
 * arrive while the player is anywhere at all. Pinning that state to a
 * component would tie it back to one screen, which is precisely the thing this
 * change exists to undo.
 *
 * One at a time, deliberately. Nothing in the model forbids asking two people
 * at once, but a player who did would end up in whichever room answered first
 * with a second friend left sitting alone in another — and no interface can
 * make that read as anything but a mistake. Asking again replaces the ask.
 */

export interface Waiting {
  /** Their handle, which is what cancelling and matching are keyed on. */
  handle: string;
  /** What to show. Falls back to the handle when the name is not to hand. */
  name: string;
  /**
   * What was asked for.
   *
   * On the pill as well as the toast, so the inviter can see which of the two
   * buttons they pressed. Two friends and two different asks in quick
   * succession is exactly when somebody loses track of what they offered.
   */
  friendly?: boolean;
  /** When the ask lapses, so the pill can count down honestly. */
  expiresAt: number;
}

let waiting: Waiting | null = null;
const listeners = new Set<() => void>();

function announce() {
  listeners.forEach((notify) => notify());
}

export function setWaiting(next: Waiting | null): void {
  waiting = next;
  announce();
}

/** Clear it, but only if it is still the ask we think it is. */
export function clearWaiting(handle: string): void {
  if (waiting?.handle !== handle) return;
  waiting = null;
  announce();
}

/**
 * The current ask, without React.
 *
 * Exported so the rule below can be tested at all: `clearWaiting` is guarded
 * by a handle comparison that exists purely to survive a race, and a guard
 * nobody can observe is a guard nobody can prove.
 */
export const currentWaiting = (): Waiting | null => waiting;

export function useWaiting(): Waiting | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => { listeners.delete(notify); };
    },
    currentWaiting,
    // Nobody is waiting on a server render, and claiming otherwise would
    // paint a pill for an ask that does not exist.
    () => null,
  );
}
