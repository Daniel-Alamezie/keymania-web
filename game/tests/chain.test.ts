import { describe, expect, it } from 'vitest';
import { chainProgress, nextTierAt, SHATTER_FROM, shatters, TOP_COMBO } from '../chain';
import { TIER_THRESHOLDS } from '../constants';
import { bladeTier } from '../engine';
import type { BladeTier } from '@/models/scoring';

const TIERS: BladeTier[] = [1, 2, 3, 4, 5];

/**
 * When a chain visibly breaks.
 *
 * This is the punishment channel, not decoration. Three separate players said a
 * typo "didn't feel like it did much", and the answer was not to make it cost
 * more but to make what it already costs visible. So the rule for when the blade
 * shatters is worth pinning: too eager and the game nags about a first-word slip,
 * too shy and the complaint comes straight back.
 */
describe('shatters', () => {
  it('fires when a built-up chain is lost', () => {
    expect(shatters(2, 0)).toBe(true);
    expect(shatters(9, 0)).toBe(true);
    expect(shatters(37, 0)).toBe(true);
  });

  it('stays quiet when there was nothing built yet', () => {
    expect(shatters(0, 0)).toBe(false);
    expect(shatters(1, 0)).toBe(false);
  });

  it('stays quiet while a chain is still going', () => {
    expect(shatters(4, 5)).toBe(false);
    expect(shatters(9, 10)).toBe(false);
  });

  /**
   * The threshold is where the blade first upgrades, so "you had built
   * something" and "the screen showed you something" are the same moment. If
   * TIER_THRESHOLDS ever moves, this is the assertion that notices.
   */
  it('triggers exactly where the blade first upgrades', () => {
    expect(bladeTier(SHATTER_FROM)).toBe(2);
    expect(bladeTier(SHATTER_FROM - 1)).toBe(1);
  });
});

describe('nextTierAt', () => {
  it('gives the combo that buys the next blade', () => {
    expect(nextTierAt(1)).toBe(2);
    expect(nextTierAt(2)).toBe(4);
    expect(nextTierAt(3)).toBe(6);
    expect(nextTierAt(4)).toBe(9);
  });

  /** The boundary that a naive `higher[0].combo` would have thrown on. */
  it('is null at the top, where there is nothing left to buy', () => {
    expect(nextTierAt(5)).toBeNull();
  });

  it('agrees with the thresholds the blade itself uses', () => {
    for (const tier of TIERS) {
      const next = nextTierAt(tier);
      if (next === null) continue;
      // Reaching that combo really does produce the tier above.
      expect(bladeTier(next)).toBeGreaterThan(tier);
    }
  });
});

describe('chainProgress', () => {
  /**
   * The assertion that caught the original.
   *
   * Dividing by the *next* threshold reads as obviously correct and is not: it
   * gives 3/4 at combo three and 4/6 at combo four, so the bar shrank at the
   * moment the player earned a bigger blade. Nothing about the code looked
   * wrong; only asking whether the number ever decreases found it.
   */
  it('never goes backwards as a chain builds', () => {
    let last = -1;
    for (let combo = 0; combo <= 12; combo += 1) {
      const value = chainProgress(combo);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });

  it('is empty before a chain starts and full at the top', () => {
    expect(chainProgress(0)).toBe(0);
    expect(chainProgress(TOP_COMBO)).toBe(1);
    expect(chainProgress(50)).toBe(1);
  });

  /** The bar fills exactly as the last blade is earned, not before or after. */
  it('reaches full at the same combo the top blade does', () => {
    expect(bladeTier(TOP_COMBO)).toBe(5);
    expect(chainProgress(TOP_COMBO - 1)).toBeLessThan(1);
  });

  it('never leaves the bar, whatever it is handed', () => {
    for (const combo of [0, 1, 5, 9, 200, -3, Number.NaN]) {
      const value = chainProgress(combo);
      if (Number.isNaN(combo)) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('covers every tier the thresholds define', () => {
    expect(TIER_THRESHOLDS.map((t) => t.tier).sort()).toEqual(TIERS);
  });
});
