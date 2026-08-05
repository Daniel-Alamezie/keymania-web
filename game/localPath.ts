'use client';

/**
 * The learning path for somebody who has not signed in.
 *
 * The path is deliberately open to signed-out visitors: the people it exists
 * for — players who cannot yet touch type — are the least likely to have made
 * an account before seeing any value, and putting a sign-up wall in front of
 * the on-ramp defeats the on-ramp.
 *
 * So progress is kept here until there is an account to keep it in. **Same
 * encoding as the server's**, one character per module indexed by position in
 * `MODULE_IDS`, so the ladder reads a local string and a server one identically
 * and nothing downstream has to know which it got.
 *
 * This is a waiting room, not a home. It is not authoritative, it does not
 * survive a cleared browser or reach a second device, and the moment somebody
 * signs in it should be pushed up and the server should win. That merge is what
 * makes the nudge honest — without it, "sign in to save your progress" is a
 * sentence that loses their progress.
 */

import { MAX_STARS, MODULE_IDS, type ModuleId } from './learnPath';

const KEY = 'keymania.learn.local.v1';

const INDEX = new Map<string, number>(MODULE_IDS.map((id, at) => [id, at]));

/**
 * A tiny store, so React can read this without a synchronous setState in an
 * effect — the same shape `serverProfile` uses, and for the same reason.
 * `getSnapshot` must return a stable string or `useSyncExternalStore` will
 * re-render forever, so the value is cached until something writes.
 */
const listeners = new Set<() => void>();
let cached: string | null = null;

export function subscribeLocal(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

/** The client's view. `serverLocalSnapshot` is the SSR answer: nothing yet. */
export function localSnapshot(): string {
  if (cached === null) cached = readRaw();
  return cached;
}

export const serverLocalSnapshot = (): string => '';

function publish(next: string) {
  cached = next;
  listeners.forEach((notify) => notify());
}

function readRaw(): string {
  try {
    const raw = window.localStorage.getItem(KEY);
    return typeof raw === 'string' ? raw.replace(/[^0-9]/g, '').slice(0, MODULE_IDS.length) : '';
  } catch {
    return '';
  }
}

/**
 * Record a passed module locally, keeping the better of the two.
 *
 * The same rule the server keeps, for the same reason: replaying a module and
 * doing worse must never cost a star, or practising becomes something to avoid.
 */
export function recordLocal(id: ModuleId, stars: number): string {
  const at = INDEX.get(id);
  if (at === undefined) return localSnapshot();

  const earned = Math.max(0, Math.min(MAX_STARS, Math.trunc(stars)));
  const current = localSnapshot();
  const held = Number(current[at] ?? '0');
  if (Number.isFinite(held) && earned <= held) return current;

  const padded = current.padEnd(at, '0');
  const next = padded.slice(0, at) + String(earned) + padded.slice(at + 1);
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* Storage disabled. The lesson still plays; it just is not remembered. */
  }
  publish(next);
  return next;
}

/** Forget the local copy, once an account has taken it over. */
export function clearLocal(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* Nothing to do — it was never written. */
  }
  publish('');
}

/** Whether there is anything here worth saving to an account. */
export const hasLocalProgress = (): boolean => /[1-9]/.test(localSnapshot());

/**
 * Every module passed locally that the account does not already hold as well.
 *
 * The merge on sign-in. Only climbs: a module the server already has at three
 * stars is not sent back down to one because this device only saw one.
 */
export function unsavedModules(server: string | undefined): { id: ModuleId; stars: number }[] {
  const mine = localSnapshot();
  const out: { id: ModuleId; stars: number }[] = [];
  MODULE_IDS.forEach((id, at) => {
    const local = Number(mine[at] ?? '0');
    const theirs = Number(server?.[at] ?? '0');
    if (Number.isFinite(local) && local > 0 && local > (Number.isFinite(theirs) ? theirs : 0)) {
      out.push({ id, stars: Math.min(MAX_STARS, local) });
    }
  });
  return out;
}
