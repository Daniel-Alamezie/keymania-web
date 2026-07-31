import { describe, expect, it } from 'vitest';
import { ghostPaceFor, ghostProfile, ghostRand, ghostWordsBy, UNKNOWN_PLAYER_WPM } from '../ghost';

/**
 * A contract test, in the sense `docs/GAME.md` §13 means it.
 *
 * The other half is `src/lib/tests/ghost.test.ts` in keymania-api, which owns
 * the truth. The server decides how a ghost duel actually went; this side only
 * animates the opponent between messages, and the two have to be computing the
 * same thing to the digit.
 *
 * That is a stronger requirement than the heat mirror has. Heat is a smooth
 * curve where a small drift shows as a bar emptying slightly wrong. This is a
 * word count: disagree by one and the arena draws a blade nobody threw, or
 * withholds one that landed. So the values below are written out literally
 * rather than derived, because a derived assertion follows a drifting copy
 * wherever it goes.
 */

const SCRIPT = [5, 3, 7, 4, 6, 8, 3, 5, 9, 4, 6, 5, 7, 3, 8, 4, 5, 6, 4, 7];

describe('the hash is the same hash', () => {
  /**
   * Pinned to actual numbers, which is the only assertion that can catch the
   * failure this exists for: two implementations that are each internally
   * consistent and disagree with each other.
   */
  it('produces the values the server produces', () => {
    expect(ghostRand(1234, 7)).toBeCloseTo(0.8099821496289223, 12);
    expect(ghostRand(0, 0)).toBeCloseTo(0.11478774505667388, 12);
    expect(ghostRand(99, 3)).toBeCloseTo(0.9208715008571744, 12);
  });
});

describe('the pace curve is the same curve', () => {
  it('pins the ends the server interpolates between', () => {
    // Exactly, not nearly. The precise lerp form exists so both sides land on
    // the constant rather than a float a hair away from it.
    expect(ghostProfile(34)).toEqual({ wpm: 34, errorRate: 0.18, jitter: 0.25 });
    expect(ghostProfile(150)).toEqual({ wpm: 150, errorRate: 0.02, jitter: 0.1 });
  });

  it('pins the floor and the default for a player with no record', () => {
    expect(UNKNOWN_PLAYER_WPM).toBe(42);
    expect(ghostProfile(0).wpm).toBe(22);
  });

  it('agrees on a speed in the middle', () => {
    // 92wpm is the exact midpoint of the curve, so both figures are the mean
    // of their two ends.
    const middle = ghostProfile(92);
    expect(middle.errorRate).toBeCloseTo(0.1, 12);
    expect(middle.jitter).toBe(0.175);
  });
});

describe('the count is the same count', () => {
  const average = ghostProfile(80);

  it('reaches the same word at the same moment', () => {
    expect(ghostWordsBy(4242, 3_000, average, SCRIPT)).toBe(4);
    expect(ghostWordsBy(4242, 6_000, average, SCRIPT)).toBe(7);
    expect(ghostWordsBy(4242, 10_000, average, SCRIPT)).toBe(11);
    expect(ghostWordsBy(4242, 16_000, average, SCRIPT)).toBe(18);

    // A second seed, because one ghost agreeing proves the constants match and
    // not that the hash does.
    expect(ghostWordsBy(77, 3_000, average, SCRIPT)).toBe(2);
    expect(ghostWordsBy(77, 6_000, average, SCRIPT)).toBe(5);
    expect(ghostWordsBy(77, 10_000, average, SCRIPT)).toBe(10);
  });

  it('starts at nothing and stops at the end of the script', () => {
    expect(ghostWordsBy(1, 0, average, SCRIPT)).toBe(0);
    expect(ghostWordsBy(1, 10 ** 9, average, SCRIPT)).toBe(SCRIPT.length);
  });

  /** The property the arena leans on: damage is the difference since last time. */
  it('never goes backwards', () => {
    let last = 0;
    for (let t = 0; t < 60_000; t += 500) {
      const words = ghostWordsBy(4242, t, average, SCRIPT);
      expect(words).toBeGreaterThanOrEqual(last);
      last = words;
    }
  });
});

describe('matching a player', () => {
  it('aims at what they type rather than at their rating', () => {
    const profile = ghostPaceFor(90, 12345);
    expect(profile.wpm).toBeGreaterThan(90 * 0.7);
    expect(profile.wpm).toBeLessThan(90 * 1.2);
  });

  it('has something to aim at for somebody who has never played', () => {
    expect(ghostPaceFor(0, 5).wpm).toBeGreaterThan(UNKNOWN_PLAYER_WPM * 0.7);
  });
});
