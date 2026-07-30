import { TIER_THRESHOLDS } from './constants';
import type { BladeTier } from '@/models/scoring';

/**
 * The arithmetic of a word chain.
 *
 * Pulled out of ComboMeter so it can be tested without a DOM. It was already
 * pure in there, which meant it was pure and unverified: the kind of code that
 * looks obviously right and quietly goes wrong at a boundary nobody reaches by
 * hand, like the top tier where there is no next threshold to divide by.
 */

/**
 * The combo a chain must have reached for its loss to be worth showing.
 *
 * Below this there was no weapon yet, so nothing broke, and playing a shatter
 * would be the game making a scene about a first-word typo. Two, because that is
 * where the blade first upgrades: the point where you have visibly built
 * something is the point where losing it means anything.
 */
export const SHATTER_FROM = 2;

/**
 * Did a chain just end, having been worth something?
 *
 * Deliberately about the combo going to zero rather than about a typo. A streak
 * also lapses by pausing longer than the combo window, and that costs the player
 * exactly as much. Asking "was something lost" catches both; asking "was there a
 * typo" would have quietly ignored half of them.
 */
export function shatters(before: number, after: number): boolean {
  return before >= SHATTER_FROM && after === 0;
}

/** Combo required for the next tier up, or null once maxed. */
export function nextTierAt(tier: BladeTier): number | null {
  const higher = TIER_THRESHOLDS.filter((t) => t.tier > tier).sort((a, b) => a.tier - b.tier);
  return higher.length ? higher[0].combo : null;
}

/** The combo at which the blade can grow no further. */
export const TOP_COMBO = Math.max(...TIER_THRESHOLDS.map((t) => t.combo));

/**
 * How full the forge bar is, from nothing to legendary.
 *
 * Measured against the top of the ladder, so it fills once across a whole chain.
 * That reads as one weapon being built, which is the story the forge tells; the
 * blade sprite beside it already says which tier you are on, so the bar does not
 * need to repeat that and can carry the longer arc instead.
 *
 * It used to divide by the *next* threshold, which meant it went backwards at
 * every upgrade: 3/4 at combo three, then 4/6 at combo four. The bar visibly
 * shrank at the exact moment the player earned a bigger blade. It survived
 * review because dividing by "the next target" reads as obviously right, and it
 * was only caught by asking a test whether the number ever decreases.
 */
export function chainProgress(combo: number): number {
  return Math.min(1, Math.max(0, combo / TOP_COMBO));
}
