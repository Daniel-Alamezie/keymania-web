import { describe, expect, it } from 'vitest';
import { currentSpeed, resolveDisplayName, trend, type DuelResult } from '../serverProfile';

/**
 * The profile summary figures.
 *
 * Both of these read a history the API stores NEWEST FIRST, which is the easy
 * thing to get backwards — a reversed `trend` would cheerfully report that an
 * improving player is getting slower, and nothing about the dashboard would
 * look broken. These tests pin the direction.
 */

/** Build a history newest-first from speeds given oldest-first, as a player
 *  would describe them ("I went 40, then 50, then 60"). */
function historyFrom(oldestFirst: number[]): DuelResult[] {
  return oldestFirst
    .map((wpm, i) => ({ wpm, accuracy: 95, won: true, at: 1000 + i, ranked: true }))
    .reverse();
}

describe('resolveDisplayName', () => {
  /**
   * The distinction these protect caused a real bug: "not loaded yet" and
   * "loaded, none chosen" were both null, so the account name was rendered in
   * both cases — and then visibly rewritten once the saved name arrived.
   */
  it('renders nothing while the saved name is unknown', () => {
    expect(resolveDisplayName(null, 'Daniel Alamezie')).toBeNull();
  });

  it('falls back to the account name once we know none is set', () => {
    expect(resolveDisplayName('', 'Daniel Alamezie')).toBe('Daniel Alamezie');
  });

  it('prefers the chosen name over the account name', () => {
    expect(resolveDisplayName('Fenrir', 'Daniel Alamezie')).toBe('Fenrir');
  });

  it('does not confuse a whitespace name with an unset one', () => {
    // ' ' is truthy, so it is a name the player somehow saved, not an absence.
    expect(resolveDisplayName(' ', 'Daniel Alamezie')).toBe(' ');
  });

  it('still returns null when unknown even with no account name', () => {
    expect(resolveDisplayName(null, '')).toBeNull();
  });
});

describe('currentSpeed', () => {
  it('averages the most recent duels, not the whole history', () => {
    // Ancient 10s should not drag the current figure down.
    const history = historyFrom([10, 10, 10, 10, 10, 50, 50, 50, 50, 50]);
    expect(currentSpeed(history, 5)).toBe(50);
  });

  it('is zero with no history rather than NaN', () => {
    expect(currentSpeed([])).toBe(0);
  });

  it('copes with fewer duels than the sample window', () => {
    expect(currentSpeed(historyFrom([40, 60]), 5)).toBe(50);
  });
});

describe('trend', () => {
  it('reports improvement as positive', () => {
    // Oldest four at 40, newest four at 60 -> +20.
    expect(trend(historyFrom([40, 40, 40, 40, 60, 60, 60, 60]), 8)).toBe(20);
  });

  it('reports decline as negative', () => {
    expect(trend(historyFrom([60, 60, 60, 60, 40, 40, 40, 40]), 8)).toBe(-20);
  });

  it('reports no movement as zero', () => {
    expect(trend(historyFrom([50, 50, 50, 50, 50, 50]), 6)).toBe(0);
  });

  it('withholds a verdict until there is enough history', () => {
    // Three duels is a mood, not a trend.
    expect(trend(historyFrom([30, 40, 90]))).toBeNull();
    expect(trend([])).toBeNull();
  });

  it('is not swung by a single outlier', () => {
    // One lucky run among otherwise flat form should barely move the figure.
    const movement = trend(historyFrom([50, 50, 50, 50, 50, 50, 50, 90]), 8);
    expect(movement).not.toBeNull();
    expect(Math.abs(movement as number)).toBeLessThanOrEqual(10);
  });
});
