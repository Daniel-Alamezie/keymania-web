import { describe, expect, it } from 'vitest';
import {
  AZURE_FROM, GOLD_FROM, LOSS_POINTS, MAX_UPSET_BONUS,
  RATING_FLOOR, START_RATING, WIN_POINTS, ratingFlame,
} from '../../models/rating';

/**
 * A contract test, in the sense `docs/GAME.md` §13 means it.
 *
 * These constants exist twice — here and in `src/lib/rating.ts` in keymania-api
 * — because the two repos deploy separately and cannot share code. The values
 * are pinned **literally** rather than derived, which is the entire point: a
 * derived assertion would follow a drifting copy wherever it went.
 *
 * The failure this guards against is unusually quiet. Nothing breaks if these
 * drift; the game simply explains the wrong rules to players in BoardGuide,
 * confidently, for as long as it takes somebody to notice. If one of these
 * fails, check which side actually changed before editing the number to match.
 */
describe('rating constants mirror the server', () => {
  it('pins the figures the board explainer quotes', () => {
    expect(START_RATING).toBe(300);
    expect(RATING_FLOOR).toBe(100);
    expect(WIN_POINTS).toBe(10);
    expect(LOSS_POINTS).toBe(-8);
    expect(MAX_UPSET_BONUS).toBe(3);
  });

  /**
   * Not arbitrary: a loss that cost as much as a win paid would make the whole
   * board a random walk around 300, and one that cost more would mean playing
   * at all had a negative expected value.
   */
  it('keeps a loss cheaper than a win', () => {
    expect(Math.abs(LOSS_POINTS)).toBeLessThan(WIN_POINTS);
  });

  /**
   * The floor has to sit below the start, or every new account would open
   * already clamped and no loss would ever register.
   */
  it('keeps the floor below the starting rating', () => {
    expect(RATING_FLOOR).toBeLessThan(START_RATING);
  });

  /**
   * The cap is what stops the fastest route up the board being to find one
   * strong player and farm them, so it must stay small next to a win.
   */
  it('keeps the upset bonus a bonus rather than the main event', () => {
    expect(MAX_UPSET_BONUS).toBeLessThan(WIN_POINTS);
  });
});

describe('ratingFlame', () => {
  it('bands a rating by the thresholds the explainer quotes', () => {
    expect(ratingFlame(START_RATING)).toBe('ember');
    expect(ratingFlame(AZURE_FROM - 1)).toBe('ember');
    expect(ratingFlame(AZURE_FROM)).toBe('azure');
    expect(ratingFlame(GOLD_FROM - 1)).toBe('azure');
    expect(ratingFlame(GOLD_FROM)).toBe('gold');
  });

  /**
   * Everybody starts on the lowest band. A starting rating that already lit the
   * middle flame would hand out a mark nobody had earned, which is the thing
   * bands were chosen over a crown to avoid.
   */
  it('starts everybody on the lowest band', () => {
    expect(START_RATING).toBeLessThan(AZURE_FROM);
  });

  it('never lands between bands', () => {
    expect(AZURE_FROM).toBeLessThan(GOLD_FROM);
    expect(ratingFlame(RATING_FLOOR)).toBe('ember');
  });
});
