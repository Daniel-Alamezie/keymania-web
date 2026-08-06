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

/**
 * The server's own floor, restated here because it lives in the other repo and
 * cannot be imported.
 *
 * `MIN_QUEUE_MS` in keymania-api's lib/ghostRoom.ts. It is what stops a
 * modified client skipping the queue, and the client's patience has to stay
 * above it: a request landing underneath is refused, so a client that asked
 * too early would wait for its own retry instead — slower than simply asking
 * later. If that constant ever moves, this test is where it should bite.
 *
 * Moved from 15 to 4 on 2026-08-06, in the same change that took the client's
 * wait from 16-24 seconds to 5-8. It had to move: leaving it at fifteen while
 * the client asked at five would have refused the first two asks of every
 * search and seated everybody at fifteen anyway, which is the entire failure
 * this constant is mirrored here to prevent.
 */
const SERVER_FLOOR_S = 4;

describe('how long anybody waits', () => {
  /**
   * Down from fifty seconds, then from forty, and production made the case
   * both times: across two days the queue paired one search with a real person
   * and four hundred and thirty with a simulated one. Holding everybody for
   * most of a minute was charging every player a spinner for a possibility
   * that fires about once in four hundred.
   */
  it('is over in seconds, not most of a minute', () => {
    expect(MIN_WAIT_S + WAIT_SPREAD_S - 1).toBeLessThanOrEqual(10);
  });

  /**
   * **The invariant that matters more than the numbers.** Whatever the wait is
   * tuned to, every possible value of it has to clear the server's floor — or
   * the first ask of every search is refused and the feature quietly runs on
   * its retry path instead.
   */
  it('never asks earlier than the server will answer', () => {
    const earliest = waitLimit(() => 0);
    const latest = waitLimit(() => 0.999);
    expect(earliest).toBeGreaterThan(SERVER_FLOOR_S);
    expect(latest).toBeGreaterThanOrEqual(earliest);
    // And a margin, not a hair: a slow socket delays the room's creation, so
    // the server's clock starts after the client's.
    expect(earliest - SERVER_FLOOR_S).toBeGreaterThanOrEqual(1);
  });

  /**
   * Varied, or the wait ends on the same second every search and becomes the
   * most obvious tell the feature has. Asserted against the spread rather than
   * a fixed count, so narrowing the range cannot silently make this vacuous.
   */
  it('is not the same every time', () => {
    const seen = new Set(Array.from({ length: 600 }, () => waitLimit()));
    expect(seen.size).toBe(WAIT_SPREAD_S);
    /* Enough values that the end of the wait is not a fixed second. Lowered
       with the wait itself: a four second spread on a five second floor is
       proportionally wider than nine on sixteen ever was. */
    expect(WAIT_SPREAD_S).toBeGreaterThanOrEqual(3);
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
