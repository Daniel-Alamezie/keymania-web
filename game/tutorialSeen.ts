'use client';

/**
 * Whether the hand tutorial has been read.
 *
 * Local only, and never sent. It awards nothing, so the server has no reason
 * to know — and keeping it out of the progress string is what lets the
 * tutorial exist as a ladder node without an entry in `MODULE_IDS`, which is
 * what keeps the append-only rule intact.
 *
 * Losing it costs somebody one glance at a screen they can replay at will,
 * which is the right price for not involving an account.
 */

const KEY = 'keymania.learn.tutorial.v1';

const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(KEY) === 'seen';
  } catch {
    cached = false;
  }
  return cached;
}

export function markSeen(): void {
  if (read()) return;
  try {
    window.localStorage.setItem(KEY, 'seen');
  } catch {
    /* Storage disabled. It simply stays the loudest node on the ladder. */
  }
  cached = true;
  listeners.forEach((notify) => notify());
}

export function subscribeSeen(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

export const seenSnapshot = (): boolean => read();

/** Unseen on the server, which cannot know either way. */
export const seenServerSnapshot = (): boolean => false;
