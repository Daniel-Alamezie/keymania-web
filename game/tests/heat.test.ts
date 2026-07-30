import { describe, expect, it } from 'vitest';
import {
  CAPACITY_MS, COOL_PER_WORDS, MS_PER_CHAR,
  coolingFor, requiredWpm, secondsLeft, stokeFor,
} from '../heat';

/**
 * A contract test, in the sense `docs/GAME.md` §13 means it.
 *
 * The other half is `src/lib/tests/heat.test.ts` in keymania-api, which writes
 * out the same numbers. The server owns whether a run is over; this side only
 * draws the bar, and a drift between them is quiet in the worst way: the bar
 * would empty at one rate while the run ended at another, so a player would die
 * with time visibly left on screen and no way to know why.
 *
 * Pinned literally rather than derived, because a derived assertion would follow
 * a drifting copy wherever it went.
 */
describe('heat constants mirror the server', () => {
  it('pins the three numbers the whole curve is made of', () => {
    expect(MS_PER_CHAR).toBe(280);
    expect(CAPACITY_MS).toBe(6_000);
    expect(COOL_PER_WORDS).toBe(90);
  });

  it('produces the same difficulty curve the server does', () => {
    expect(requiredWpm(0)).toBe(43);
    expect(requiredWpm(COOL_PER_WORDS)).toBe(86);
    expect(requiredWpm(COOL_PER_WORDS * 2)).toBe(129);
  });

  /** Nobody slow-types to 500. The reason the mode has a clock at all. */
  it('is unsurvivable long before a 500 word run', () => {
    expect(requiredWpm(500)).toBeGreaterThan(250);
  });
});

describe('coolingFor', () => {
  it('starts at a pace anybody can hold and only ever tightens', () => {
    expect(coolingFor(0)).toBe(1);
    let last = 0;
    for (let words = 0; words <= 400; words += 10) {
      const cooling = coolingFor(words);
      expect(cooling).toBeGreaterThanOrEqual(last);
      last = cooling;
    }
  });

  it('treats a negative count as the start rather than going backwards', () => {
    expect(coolingFor(-50)).toBe(1);
  });
});

describe('stokeFor', () => {
  it('pays for long words in proportion', () => {
    expect(stokeFor(4)).toBe(4 * MS_PER_CHAR);
    expect(stokeFor(12)).toBe(3 * stokeFor(4));
  });

  it('never grants heat for nothing', () => {
    expect(stokeFor(0)).toBe(0);
    expect(stokeFor(-3)).toBe(0);
  });
});

describe('secondsLeft', () => {
  /**
   * Heat is stored as milliseconds of *typing*, not of clock: it is spent faster
   * than real time as the run goes on. The bar has to be animated over an actual
   * duration, so the two have to be converted, and getting this backwards would
   * draw a bar that empties slower the harder the game gets.
   */
  it('shortens as the run gets harder, on the same heat', () => {
    const early = secondsLeft(CAPACITY_MS, 0);
    const late = secondsLeft(CAPACITY_MS, COOL_PER_WORDS * 2);
    expect(early).toBe(6);
    expect(late).toBeLessThan(early);
    expect(late).toBeCloseTo(2, 5);
  });

  it('is never negative, however cold the forge is', () => {
    expect(secondsLeft(0, 10)).toBe(0);
    expect(secondsLeft(-500, 10)).toBe(0);
  });
});
