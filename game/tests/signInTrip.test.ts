import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimSignInReturn, markSignInStarted } from '../signInTrip';

/**
 * Pairing a sign-in press with the return that follows it.
 *
 * This is the only part of the funnel that has to survive leaving the site, and
 * it exists to separate two failures that otherwise look identical: nobody
 * pressed the sign-in button, and everybody pressed it and was lost at the
 * identity provider. Those have opposite fixes, so a bug here does not produce a
 * missing number — it produces a confidently wrong one, which is worse.
 */

const KEY = 'keymania.signInTrip';

/** A sessionStorage that behaves like the real one, in a test runner with none. */
function fakeWindow() {
  const store = new Map<string, string>();
  return {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
    raw: store,
  };
}

let win: ReturnType<typeof fakeWindow>;

beforeEach(() => {
  win = fakeWindow();
  vi.stubGlobal('window', win);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a completed trip', () => {
  it('reports where it started and how long it took', () => {
    markSignInStarted('play');
    vi.advanceTimersByTime(21_400);

    expect(claimSignInReturn()).toEqual({ from: 'play', seconds: 21 });
  });

  /**
   * Claimed once, ever.
   *
   * The return is checked from an effect that reruns on every route change, so a
   * marker left in place would report a fresh sign-in for the rest of the tab's
   * life. That does not merely inflate the number — it inflates the *success*
   * end of the funnel, which is the direction that would talk somebody out of
   * fixing a real problem.
   */
  it('cannot be claimed twice', () => {
    markSignInStarted('survival');
    expect(claimSignInReturn()).not.toBeNull();
    expect(claimSignInReturn()).toBeNull();
  });
});

describe('a trip that was never really completed', () => {
  /**
   * Somebody who pressed sign in, wandered off, and came back to the tab an hour
   * later did not complete a sign-in flow in any sense worth counting — and
   * counting them would flatter the exact number this exists to scrutinise.
   */
  it('is not counted once it has gone stale', () => {
    markSignInStarted('play');
    vi.advanceTimersByTime(11 * 60 * 1000);

    expect(claimSignInReturn()).toBeNull();
  });

  /** And is cleared anyway, or it sits there being re-examined forever. */
  it('is cleared even though it did not count', () => {
    markSignInStarted('play');
    vi.advanceTimersByTime(11 * 60 * 1000);
    claimSignInReturn();

    expect(win.raw.has(KEY)).toBe(false);
  });
});

describe('nothing to claim', () => {
  it('is the ordinary case, and is quiet about it', () => {
    expect(claimSignInReturn()).toBeNull();
  });

  /**
   * Somebody else's key under the same name, or a shape from an older version of
   * this file. A funnel that throws on a stale marker takes the page down with
   * it, and no measurement is worth that.
   */
  it('survives a value it cannot read', () => {
    win.raw.set(KEY, 'not json');
    expect(claimSignInReturn()).toBeNull();

    win.raw.set(KEY, JSON.stringify({ nothing: true }));
    expect(claimSignInReturn()).toBeNull();
  });

  /**
   * A clock that went backwards — a machine correcting its time, or a marker
   * written before a daylight-saving jump. Negative seconds in a funnel is the
   * kind of number that gets a dashboard quietly distrusted.
   */
  it('rejects a trip that appears to have finished before it began', () => {
    markSignInStarted('profile');
    vi.setSystemTime(new Date('2026-08-01T11:59:00Z'));

    expect(claimSignInReturn()).toBeNull();
  });
});

describe('storage that refuses to co-operate', () => {
  /**
   * Private browsing, or storage disabled. Losing the pairing under-reports
   * returns rather than inventing them, which is the safe direction for a number
   * whose whole purpose is to be doubted.
   */
  it('does not throw, and simply reports nothing', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => { throw new Error('denied'); },
        setItem: () => { throw new Error('denied'); },
        removeItem: () => { throw new Error('denied'); },
      },
    });

    expect(() => markSignInStarted('play')).not.toThrow();
    expect(claimSignInReturn()).toBeNull();
  });
});
