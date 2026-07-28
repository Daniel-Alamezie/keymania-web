import { describe, expect, it } from 'vitest';
import { tickDelay } from '../countdown';

/**
 * The countdown has to finish no earlier than the server's, or the first words
 * of a duel are thrown away by the referee without telling anybody.
 */
describe('tickDelay', () => {
  it('spreads the remaining time across the ticks that are left', () => {
    expect(tickDelay(3000, 3)).toBe(1000);
    expect(tickDelay(2000, 2)).toBe(1000);
  });

  /**
   * The old behaviour, pinned so it cannot come back: three fixed 750ms ticks
   * finish in 2250ms against a server that waits 3000ms, leaving a 750ms
   * window where every committed word is silently discarded.
   */
  it('does not finish before a 3000ms server countdown', () => {
    let left = 3000;
    for (let ticks = 3; ticks > 0; ticks -= 1) left -= tickDelay(left, ticks);
    expect(left).toBeLessThanOrEqual(0);
  });

  it('catches up when a tick runs late, rather than compounding the drift', () => {
    // Two ticks left but only 400ms to go: the rest must be spent quickly, not
    // at the original pace.
    expect(tickDelay(400, 2)).toBe(200);
  });

  it('never waits a negative time, however late it already is', () => {
    expect(tickDelay(-900, 2)).toBe(0);
    expect(tickDelay(1000, 0)).toBe(0);
  });
});
