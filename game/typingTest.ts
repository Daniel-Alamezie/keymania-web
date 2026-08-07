'use client';

/**
 * The typing test: a clock, some words, and a number at the end.
 *
 * The one mode in the practice area that measures you, which is why it sits
 * beside the warm-up rather than replacing it. The warm-up exists for the
 * minute before somebody is ready to be measured; this is for the minute
 * after. A player who wants to know their speed has, until now, had to fight
 * a bot to find out, and a duel answers a different question — it measures how
 * you type while something is throwing blades at you.
 *
 * **Nothing here reaches the account.** Not the leaderboard, not the duelling
 * record, and above all not `bestSpeed`, which feeds the bot unlock ladder:
 * a test figure landing there would open Champion for somebody who had never
 * fought anybody, which is the exact trap `warmupBest` documents. The warm-up
 * is safe from it by keeping only a streak, a quantity that cannot be mistaken
 * for a speed. This mode has no such protection, because a speed is precisely
 * what it produces, so the rule has to be held here instead: the best is
 * stored on the device, under this module's own key, and no code path from
 * here writes anything to a profile.
 */

/**
 * How long a test may run.
 *
 * Three lengths rather than a free choice. Thirty seconds is long enough to
 * settle into a rhythm and short enough to retry on a whim, sixty is the
 * length every other typing test on the internet uses and therefore the one
 * people will want to compare, and forty-five exists because the gap between
 * them is otherwise a doubling.
 *
 * A comparable figure needs a fixed clock, which is the whole reason these are
 * a closed set: two tests of different lengths are not the same test, so each
 * keeps its own record below.
 */
export const TEST_SECONDS = [30, 45, 60] as const;

export type TestSeconds = (typeof TEST_SECONDS)[number];

export const DEFAULT_SECONDS: TestSeconds = 30;

/** Whether a number is one of the lengths offered. Used on the stored record. */
export const isTestSeconds = (value: unknown): value is TestSeconds =>
  TEST_SECONDS.includes(value as TestSeconds);

/**
 * Words per minute, on the standard five-character word.
 *
 * **Deliberately the same arithmetic as `survivalWpm`**, and that matters more
 * than it looks: this screen exists to tell somebody how fast they type, and if
 * its answer disagreed with the number on their duel results and their profile,
 * the one they would believe is the one that flattered them. A speed only means
 * something if it means the same thing everywhere in the game.
 *
 * Counted from correct keystrokes rather than every keystroke, so this is net
 * speed. Typing sixty characters of which ten were wrong is not sixty
 * characters of typing, and a test that says otherwise rewards mashing. The
 * accuracy figure beside it says what the mistakes cost.
 */
export function testWpm(hits: number, seconds: number): number {
  if (!Number.isFinite(hits) || !Number.isFinite(seconds)) return 0;
  if (hits <= 0 || seconds <= 0) return 0;
  return Math.round(hits / 5 / (seconds / 60));
}

/**
 * The share of keystrokes that were the right one, as a percentage.
 *
 * A test nobody typed in is 100 rather than 0, the same call `warmupAccuracy`
 * makes: no mistakes have been made, and opening a result card on 0% would be
 * both false and unkind in one line.
 */
export function testAccuracy(hits: number, misses: number): number {
  const struck = hits + misses;
  if (struck <= 0) return 100;
  return Math.round((hits / struck) * 100);
}

/* -------------------------------------------------------------------------
 * The record, per length.
 *
 * Shaped after `warmupBest` on purpose — same store idiom, same
 * `useSyncExternalStore` contract, same reasons — but keyed by duration,
 * because a thirty second best and a sixty second best are records of two
 * different tests and one would quietly overwrite the other.
 * ---------------------------------------------------------------------- */

const KEY = 'keymania.typingtest.best.v1';

type Records = Partial<Record<TestSeconds, number>>;

const listeners = new Set<() => void>();
let cached: Records | null = null;

function read(): Records {
  if (cached !== null) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const clean: Records = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        const seconds = Number(key);
        /**
         * Every entry validated rather than trusted. This is storage a player
         * can edit, and a junk value here would render as a personal best of
         * NaN on a card whose whole job is to state a number.
         */
        if (isTestSeconds(seconds) && typeof value === 'number'
            && Number.isFinite(value) && value > 0) {
          clean[seconds] = Math.floor(value);
        }
      }
    }
    cached = clean;
  } catch {
    // Corrupt, or storage disabled. An empty record shows no best, which is
    // the honest reading of "we do not know".
    cached = {};
  }
  return cached;
}

/** The best speed recorded at this length, or 0 for a length never run. */
export const bestAt = (seconds: TestSeconds): number => read()[seconds] ?? 0;

/**
 * Keep a result if it beats the record at that length.
 *
 * Returns whether it was a new best, so the card can say so without reading
 * the value back after it has already been replaced.
 */
export function recordTest(seconds: TestSeconds, wpm: number): boolean {
  if (!isTestSeconds(seconds) || !Number.isFinite(wpm) || wpm <= 0) return false;
  const current = read();
  if (wpm <= (current[seconds] ?? 0)) return false;

  const next: Records = { ...current, [seconds]: Math.floor(wpm) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Storage disabled. The card still shows this run's figures; only the
       remembering is lost, which is the least important half. */
  }
  cached = next;
  listeners.forEach((notify) => notify());
  return true;
}

export function subscribeTests(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

/**
 * A stable snapshot for `useSyncExternalStore`.
 *
 * The raw string rather than the parsed record: the hook compares snapshots by
 * identity, and `read()` returns a fresh object often enough that handing it
 * back directly would re-render for ever. Callers read the values through
 * `bestAt` once this has told them something changed.
 */
export const testsSnapshot = (): string | null => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/** Null on the server, which cannot know either way. */
export const testsServerSnapshot = (): string | null => null;

/** The best across every length, for the hub door's one line. */
export function bestOverall(): number {
  const records = read();
  return TEST_SECONDS.reduce((top, seconds) => Math.max(top, records[seconds] ?? 0), 0);
}

/** Test seam, and the dev bench's reset. */
export function clearTests(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* Nothing to clear. */
  }
  cached = null;
  listeners.forEach((notify) => notify());
}
