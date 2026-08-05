import { describe, expect, it } from 'vitest';
import { daysTyped } from '../../models/streak';
import type { Streak } from '../../models/streak';

/**
 * "Days typed", the figure the calendar was already showing and nothing named.
 *
 * Worth its own tests because it is the one number on that panel derived in
 * the browser rather than sent by the server, and because the distinction it
 * draws — days you turned up, as against the run you are currently on — is
 * exactly the one a reader is likely to conflate.
 */

const streak = (calendar?: string): Streak => ({
  current: 0, best: 0, today: 20_000, origin: 19_700, calendar,
});

describe('daysTyped', () => {
  it('counts every day with anything on it', () => {
    // Four marks, three of them days that were played.
    expect(daysTyped(streak('1020304'))).toBe(4);
  });

  it('ignores the days nobody played', () => {
    expect(daysTyped(streak('0000000'))).toBe(0);
  });

  /**
   * The distinction the tile exists to draw. A run of four broken by a gap,
   * then more play: the streak resets, this does not.
   */
  it('keeps climbing across a break, unlike a streak', () => {
    expect(daysTyped(streak('1111' + '00000' + '111'))).toBe(7);
  });

  it('counts a level this build does not know about as a day played', () => {
    // A record written by a newer server. The bands say how much was typed;
    // this asks only whether somebody turned up, so an unfamiliar mark is
    // still a yes.
    expect(daysTyped(streak('19'))).toBe(2);
  });

  /**
   * Every absent shape, because this renders on the first profile a brand new
   * player ever opens and must not throw there.
   */
  it('says nothing rather than failing when there is no calendar', () => {
    expect(daysTyped(undefined)).toBe(0);
    expect(daysTyped(streak(undefined))).toBe(0);
    expect(daysTyped(streak(''))).toBe(0);
  });

  it('is not confused by a stray character', () => {
    // Corrupt storage must not inflate the count: only a positive level is a
    // day, so a letter falls through as nothing.
    expect(daysTyped(streak('1x1'))).toBe(2);
  });

  it('counts a full year without missing the ends', () => {
    expect(daysTyped(streak('1'.repeat(371)))).toBe(371);
  });
});
