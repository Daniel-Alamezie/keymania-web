import { describe, expect, it } from 'vitest';
import { nextRollover, untilRollover, WEEKLY_MS } from '../weeklyClock';

/**
 * The client's copy of the boundary rule, pinned against the same
 * independently-computed epochs the API's tests use. If these two files ever
 * disagree, the board tab counts down to a moment the server does not
 * recognise — so they are tested against the same constants, not each other.
 */
describe('the next rollover', () => {
  it('finds Monday noon London from a Sunday in summer (11:00 UTC)', () => {
    // Sun 2 Aug 2026 22:00 UTC -> Mon 3 Aug 2026 11:00 UTC.
    expect(nextRollover(1785708000000)).toBe(1785754800000);
  });

  it('rolls a moment already past noon Monday to the following week', () => {
    // Mon 3 Aug 2026 12:00 London exactly: the boundary just passed.
    expect(nextRollover(1785754800000)).toBe(1785754800000 + 7 * 86_400_000);
  });

  it('finds Monday noon London in winter (12:00 UTC)', () => {
    // Sun 10 Jan 2027 18:00 UTC -> Mon 11 Jan 2027 12:00 UTC.
    expect(nextRollover(1799604000000)).toBe(1799668800000);
  });

  it('keeps the last minute before the boundary in the old week', () => {
    // Mon 3 Aug 2026 11:59 London: the rollover is one minute away.
    expect(nextRollover(1785754740000)).toBe(1785754800000);
  });
});

describe('the countdown caption', () => {
  it('speaks in two units, coarsest first', () => {
    // 13h to the boundary from Sunday 22:00.
    expect(untilRollover(1785708000000)).toBe('13h 0m');
  });

  it('never shows zero minutes to a player one tick from the line', () => {
    expect(untilRollover(1785754800000 - 20_000)).toBe('1m');
  });

  it('matches the window the server referees', () => {
    expect(WEEKLY_MS).toBe(30_000);
  });
});
