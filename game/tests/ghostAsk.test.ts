import { describe, expect, it } from 'vitest';
import {
  askAttempt, MIN_WAIT_S, RETRY_EVERY_S, RETRY_FOR_S, WAIT_SPREAD_S, waitLimit,
} from '../ghostAsk';

/**
 * When the search stops holding out for a person.
 *
 * Tested as arithmetic because the failure mode is silence. Nothing here can
 * throw; it can only decline to fire, and the visible result of that is a player
 * watching a spinner until they close the tab. There is no error, no log and no
 * complaint — just somebody who left.
 */

describe('how long anybody waits', () => {
  /**
   * The change that prompted all of this. Fifty seconds of spinner was a bounce
   * for most people, and it was the common case rather than the tail: spread
   * flat across thirty seconds, most searches ended nearer the top than the
   * bottom.
   */
  it('is never longer than about forty seconds', () => {
    expect(MIN_WAIT_S + WAIT_SPREAD_S - 1).toBe(39);
  });

  /**
   * And never shorter than twenty, because the server keeps its own floor and
   * will refuse anything earlier. A client that dropped below it would spend
   * every search asking for something it cannot have.
   */
  it('always gives the real queue its chance first', () => {
    expect(waitLimit(() => 0)).toBe(20);
    expect(waitLimit(() => 0.999)).toBe(39);
  });

  /**
   * Varied, or the wait ends on the same second every search and becomes the
   * most obvious tell the feature has.
   */
  it('is not the same every time', () => {
    const seen = new Set(Array.from({ length: 400 }, () => waitLimit()));
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe('asking', () => {
  const LIMIT = 25;

  it('does not happen while there is still time on the clock', () => {
    for (let s = 0; s < LIMIT; s += 1) expect(askAttempt(s, LIMIT)).toBe(0);
  });

  it('happens the moment the wait is up', () => {
    expect(askAttempt(LIMIT, LIMIT)).toBe(1);
  });

  /**
   * **The bug this file exists for.**
   *
   * The server times its floor from when it opened the room; this screen counts
   * from when it appeared. On a slow connection those differ by enough that the
   * request lands under the floor and is refused — and the old code asked
   * exactly once, so that player waited for a human who was never coming, on a
   * screen that would never resolve.
   */
  it('happens again, which is the whole point', () => {
    expect(askAttempt(LIMIT + RETRY_EVERY_S, LIMIT)).toBe(2);
    expect(askAttempt(LIMIT + RETRY_EVERY_S * 2, LIMIT)).toBe(3);
  });

  it('stays quiet between attempts', () => {
    for (let s = LIMIT + 1; s < LIMIT + RETRY_EVERY_S; s += 1) {
      expect(askAttempt(s, LIMIT)).toBe(0);
    }
  });

  /**
   * Each attempt has to be a *different* number, or the caller — which fires on
   * the value changing — sees no change and asks nothing. A version returning a
   * boolean would pass every test above and still never ask twice.
   */
  it('numbers the attempts, so a caller watching for a change sees one', () => {
    const fired = [];
    for (let s = 0; s <= LIMIT + RETRY_FOR_S; s += 1) {
      const attempt = askAttempt(s, LIMIT);
      if (attempt !== 0) fired.push(attempt);
    }
    expect(fired).toEqual([...new Set(fired)]);
    expect(fired.length).toBe(RETRY_FOR_S / RETRY_EVERY_S + 1);
  });

  /**
   * Bounded, because with simulated opponents switched off every request returns
   * silence — and an unbounded retry would poll for as long as somebody left a
   * tab open on a screen that is not going to resolve.
   */
  it('gives up eventually rather than polling forever', () => {
    expect(askAttempt(LIMIT + RETRY_FOR_S, LIMIT)).toBeGreaterThan(0);
    for (let s = LIMIT + RETRY_FOR_S + 1; s < LIMIT + RETRY_FOR_S + 200; s += 1) {
      expect(askAttempt(s, LIMIT)).toBe(0);
    }
  });
});
