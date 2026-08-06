'use client';

/**
 * The longest clean streak this browser has reached in the warm-up.
 *
 * **Local only, and deliberately not on the account.** The warm-up is the one
 * mode with nothing at stake, and the fastest way to put something at stake is
 * to sync a number to a profile where it can be compared. A figure that lives
 * on the device is a figure you are competing with yourself over, which is the
 * most this mode should ever ask.
 *
 * It is also the safe place for it. Nothing about the warm-up may touch the
 * duelling record: see `saveResult` for why, and note that `bestSpeed` feeds
 * the bot unlock ladder, so a warm-up figure reaching `bestWpm` would silently
 * open Champion for somebody who had never fought anybody. A streak count
 * cannot be mistaken for a speed, which is the other reason this is the only
 * thing kept.
 *
 * Losing it costs somebody a number they can beat again in five minutes, which
 * is the right price for not involving an account.
 */

const KEY = 'keymania.warmup.best.v1';

const listeners = new Set<() => void>();
let cached: number | null = null;

function read(): number {
  if (cached !== null) return cached;
  try {
    const raw = Number(window.localStorage.getItem(KEY));
    cached = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    cached = 0;
  }
  return cached;
}

/**
 * Keep a streak if it beats the one on record.
 *
 * Returns whether it was a new best, because the screen wants to say so and
 * asking twice would mean reading the old value after it had been replaced.
 */
export function recordStreak(streak: number): boolean {
  if (!Number.isFinite(streak) || streak <= read()) return false;

  const best = Math.floor(streak);
  try {
    window.localStorage.setItem(KEY, String(best));
  } catch {
    /* Storage disabled. The session still shows its own best; only the
       remembering is lost, which is the least important half. */
  }
  cached = best;
  listeners.forEach((notify) => notify());
  return true;
}

export function subscribeBest(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

export const bestSnapshot = (): number => read();

/** Zero on the server, which cannot know either way. */
export const bestServerSnapshot = (): number => 0;

/** Test seam, and the dev bench's reset. */
export function clearBest(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* Nothing to clear. */
  }
  cached = null;
  listeners.forEach((notify) => notify());
}
