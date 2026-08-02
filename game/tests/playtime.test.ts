import { describe, expect, it } from 'vitest';
import { formatPlayTime } from '@/models/profile';

/**
 * A career total, said the way a card should say it.
 *
 * Two rules worth pinning. Never seconds — a figure that ticks invites
 * watching it tick. And never a bare zero for somebody who has played: the
 * seed can leave a brand-new account at a few seconds, and "0m" under a
 * recorded duel is a claim the card cannot mean.
 */
describe('formatPlayTime', () => {
  it('says hours and minutes for a career', () => {
    expect(formatPlayTime(12 * 3_600_000 + 40 * 60_000)).toBe('12h 40m');
  });

  it('drops the hours while there are none', () => {
    expect(formatPlayTime(38 * 60_000)).toBe('38m');
  });

  it('rounds within the hour, not into it', () => {
    expect(formatPlayTime(60 * 60_000 - 1)).toBe('59m');
    expect(formatPlayTime(60 * 60_000)).toBe('1h 0m');
  });

  it('never tells somebody who has played that they have not', () => {
    expect(formatPlayTime(4_000)).toBe('<1m');
  });

  it('is honest about a genuine zero', () => {
    expect(formatPlayTime(0)).toBe('0m');
  });
});
