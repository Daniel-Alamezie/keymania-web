/**
 * Run west of Greenwich on purpose.
 *
 * The day numbers in a streak are already local: the server derived them from
 * the player's own offset. Anything here that re-applies the *browser's* offset
 * shifts every square by one, and in a UTC test environment that mistake is
 * invisible — both spellings agree. Los Angeles is eight hours behind, so a
 * date read back without `timeZone: 'UTC'` lands on the previous day and the
 * assertion below has something to catch.
 */
process.env.TZ = 'America/Los_Angeles';

import { describe, expect, it } from 'vitest';
import {
  cellTip, columns, dateOf, monthLabels, weekday, WEEKS, type Streak,
} from '../streak';

/**
 * The grid's arithmetic.
 *
 * Every failure here is off by one and looks entirely plausible on screen: a
 * column that starts on a Tuesday, a square drawn one row high, a future day
 * rendered as a day somebody missed. None of them throw, and none of them are
 * visible without counting, which is exactly why they are tested rather than
 * eyeballed.
 */

/** 2026-08-03 was a Monday. */
const MONDAY = Math.floor(Date.UTC(2026, 7, 3) / 86_400_000);

const streak = (over: Partial<Streak> = {}): Streak => ({
  current: 3, best: 9, today: MONDAY, ...over,
});

describe('weekday', () => {
  it('puts Monday in the top row', () => {
    expect(weekday(MONDAY)).toBe(0);
  });

  it('runs Monday to Sunday', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => weekday(MONDAY + n))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('agrees with the calendar it claims to follow', () => {
    // Epoch day 0 was a Thursday. If that anchor is wrong every square moves.
    expect(dateOf(0).getUTCDay()).toBe(4);
    expect(weekday(0)).toBe(3);
  });

  it('never returns a negative row', () => {
    // JavaScript's % keeps the left operand's sign, so -1 % 7 is -1 and would
    // place a day in row minus one.
    expect([-1, -8, -366].every((day) => weekday(day) >= 0 && weekday(day) < 7)).toBe(true);
  });
});

describe('columns', () => {
  it('draws nothing without a streak', () => {
    expect(columns(undefined)).toEqual([]);
  });

  it('is a full year of weeks, seven rows each', () => {
    const cols = columns(streak());
    expect(cols).toHaveLength(WEEKS);
    expect(cols.every((c) => c.length === 7)).toBe(true);
  });

  it('starts every column on a Monday', () => {
    // The whole point of anchoring on the Monday rather than on today minus
    // 370: otherwise each column is a rolling seven days and the weekday labels
    // down the left are a lie.
    const cols = columns(streak());
    expect(cols.every((c) => c[0].day === undefined || weekday(c[0].day) === 0)).toBe(true);
  });

  it('ends on the week containing today', () => {
    const cols = columns(streak());
    const last = cols.at(-1)!;
    expect(last.some((cell) => cell.day === MONDAY)).toBe(true);
  });

  describe('the future', () => {
    /**
     * A Wednesday nobody played and a Wednesday that has not happened yet are
     * different things. Drawing them alike tells somebody they missed a day
     * they could not possibly have played.
     */
    it('leaves days after today without a date', () => {
      // Today is the Monday, so Tue to Sun of that column are still to come.
      const last = columns(streak()).at(-1)!;
      expect(last[0].day).toBe(MONDAY);
      expect(last.slice(1).every((cell) => cell.day === undefined)).toBe(true);
    });

    it('has no future cells when today is a Sunday', () => {
      const sunday = MONDAY + 6;
      const last = columns(streak({ today: sunday })).at(-1)!;
      expect(last.every((cell) => cell.day !== undefined)).toBe(true);
    });
  });

  describe('reading the calendar', () => {
    it('places a level on the right day', () => {
      const cols = columns(streak({ origin: MONDAY - 2, calendar: '134' }));
      const flat = cols.flat();
      expect(flat.find((c) => c.day === MONDAY - 2)?.level).toBe(1);
      expect(flat.find((c) => c.day === MONDAY - 1)?.level).toBe(3);
      expect(flat.find((c) => c.day === MONDAY)?.level).toBe(4);
    });

    it('treats days before the record as empty, not missing', () => {
      const cols = columns(streak({ origin: MONDAY, calendar: '4' }));
      expect(cols.flat().find((c) => c.day === MONDAY - 30)?.level).toBe(0);
    });

    it('treats days after the record as empty', () => {
      // Reachable whenever somebody has not played for a while: the calendar
      // stops at their last day and today is further on.
      const cols = columns(streak({ today: MONDAY + 10, origin: MONDAY, calendar: '4' }));
      expect(cols.flat().find((c) => c.day === MONDAY + 5)?.level).toBe(0);
    });

    it('clamps a level it does not recognise', () => {
      // A newer server, or a corrupted record. An out-of-range level would
      // index past the colour ramp and render as an untinted hole.
      const cols = columns(streak({ origin: MONDAY, calendar: '9' }));
      expect(cols.flat().find((c) => c.day === MONDAY)?.level).toBe(4);
    });

    it('survives a non-numeric character', () => {
      const cols = columns(streak({ origin: MONDAY, calendar: 'x' }));
      expect(cols.flat().find((c) => c.day === MONDAY)?.level).toBe(0);
    });

    it('handles a player who has never typed', () => {
      const cols = columns(streak({ current: 0, best: 0 }));
      expect(cols.flat().every((c) => c.level === 0)).toBe(true);
    });
  });

  it('covers exactly a year back from the current week', () => {
    const cols = columns(streak());
    const first = cols[0][0].day!;
    expect(MONDAY - first).toBe((WEEKS - 1) * 7);
  });
});

describe('monthLabels', () => {
  it('labels a column when its Monday enters a new month', () => {
    const labels = monthLabels(columns(streak()));
    // A year of weeks crosses twelve boundaries, and the first column is
    // skipped when it is a stub.
    expect(labels.length).toBeGreaterThanOrEqual(11);
    expect(labels.length).toBeLessThanOrEqual(12);
  });

  it('never labels the same month twice in a row', () => {
    const labels = monthLabels(columns(streak()));
    expect(labels.every((l, i) => i === 0 || l.label !== labels[i - 1].label)).toBe(true);
  });

  it('never labels the last few columns', () => {
    /**
     * A month name will not wrap and a column is a dozen pixels, so a label in
     * the final column runs past the end of the grid. That overflow is barely
     * visible in itself and does something very visible: it widens the whole
     * calendar past its container and puts a horizontal scrollbar under a grid
     * that otherwise fits exactly.
     */
    const cols = columns(streak());
    const last = monthLabels(cols).at(-1)!;
    expect(cols.length - 1 - last.week).toBeGreaterThanOrEqual(3);
  });

  it('never labels the leftmost column', () => {
    // A label hard against the left edge, a few pixels from the next one, reads
    // as two months in the same place.
    expect(monthLabels(columns(streak())).some((l) => l.week === 0)).toBe(false);
  });

  it('places labels in ascending column order', () => {
    const labels = monthLabels(columns(streak()));
    expect(labels.map((l) => l.week)).toEqual([...labels.map((l) => l.week)].sort((a, b) => a - b));
  });
});

describe('cellTip', () => {
  it('says nothing for a day that has not happened', () => {
    expect(cellTip({ level: 0 })).toBeUndefined();
  });

  it('names the band rather than inventing a count', () => {
    // One character per day buys a year of history cheaply, and the price is
    // that an exact number is not available to state.
    expect(cellTip({ day: MONDAY, level: 2 })).toContain('30 to 79 words');
  });

  it('says a quiet day was quiet', () => {
    expect(cellTip({ day: MONDAY, level: 0 })).toContain('nothing typed');
  });

  it('reads the date back in UTC, because the day number is already local', () => {
    /**
     * Compared against the same conversion done deliberately, rather than
     * against a hand-written date string, so the assertion does not depend on
     * the runner's locale (en-GB says "3 Aug 2026", en-US "Aug 3, 2026").
     */
    const asUtc = dateOf(MONDAY).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
    const asLocal = dateOf(MONDAY).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    /**
     * The guard that stops this test proving nothing.
     *
     * Eight hours west of UTC these two spellings differ, and the assertion
     * below has teeth. Run in UTC they are identical and it would pass whether
     * or not the code applies the offset, so this fails loudly instead of
     * quietly certifying an untested claim.
     */
    expect(asLocal).not.toBe(asUtc);

    expect(cellTip({ day: MONDAY, level: 1 })).toContain(asUtc);
  });
});
