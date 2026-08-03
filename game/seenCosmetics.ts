'use client';

import { useSyncExternalStore } from 'react';

/**
 * Which unlocks a player has already looked at.
 *
 * Cosmetics arrive quietly. A challenge completes on the results screen, a
 * Monday job hands out a badge while nobody is watching, and the founder kit
 * grew a colour a week after the badge — in every case the reward lands on
 * the record and then waits to be noticed. Somebody has to open Appearance,
 * on a hunch, to find out. This is the hunch, replaced by a number.
 *
 * **Device-level, like the settings and unlike the cosmetics themselves.**
 * What you own is identity and follows you everywhere; whether you have
 * *seen* it is a fact about this browser. Two devices each showing the dot
 * once is right — you did not look on that one yet — and syncing it would be
 * a server round trip to answer a question the server has no opinion about.
 *
 * The stored list is of ids, not a count. A count cannot survive a new unlock
 * arriving while an old one is still unseen, and it would silently clear the
 * dot for something nobody looked at.
 */

const KEY = 'keymania.seenCosmetics';

const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Validated rather than trusted: a corrupted value must not be able to
    // throw inside a render, and "unknown shape" means the same as "nothing
    // seen" — which shows the dot again rather than hiding an unlock.
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Mark everything currently owned as seen.
 *
 * Takes the whole earned list rather than appending one id at a time,
 * because the moment that matters is "the player opened the panel and looked
 * at it" — at which point every unlock on screen has been seen, including
 * ones that arrived while they were reading.
 */
export function markCosmeticsSeen(earned: string[]): void {
  try {
    // A union rather than a replacement: an id that has left the catalogue
    // must not become unseen again if it ever comes back.
    const merged = [...new Set([...read(), ...earned])];
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* private mode — the dot will simply return next visit */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Another tab looking at the panel counts as having looked.
  window.addEventListener('storage', notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', notify);
  };
}

/**
 * How many owned cosmetics this browser has not shown its player yet.
 *
 * The server snapshot is zero: localStorage does not exist during a server
 * render, and a badge that renders a number on the server and a different
 * one on the client is a hydration mismatch. Zero means the dot appears on
 * the first client render rather than the page failing to hydrate — the same
 * arrangement `useSoundEnabled` uses, for the same reason.
 */
export function useUnseenCosmetics(earned: string[] | undefined): number {
  const seen = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => null);

  if (!earned || earned.length === 0) return 0;
  const already = new Set(seen ? read() : []);
  return earned.filter((id) => !already.has(id)).length;
}
