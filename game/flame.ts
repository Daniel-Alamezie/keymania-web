/**
 * How hot the path is burning.
 *
 * The ladder's background is a flame that grows with progress, which is the
 * game's own metaphor rather than a new one — the menu already talks about
 * stoking the forge, duels throw embers, and a blade tier is heat. A path that
 * gets warmer as it is walked says "you are doing this" in the language the
 * rest of the game already speaks.
 *
 * **Measured in stars, not modules.** Twelve modules would give twelve steps,
 * and eleven of them would be invisible — a bar that moves once every five
 * minutes is not encouragement, it is a progress bar. Stars give thirty-six,
 * so the flame answers a three-star run on a module already passed, which is
 * exactly the behaviour the star economy exists to reward and the one thing a
 * module-counting flame would ignore.
 *
 * Nothing here decides anything. It is decoration over a number the server
 * already owns, and it must never be the reason a screen re-reads progress.
 */

import { MAX_STARS, MODULE_IDS, starsFor } from './learnPath';

/** Every star on the path, if somebody mastered all of it. */
export const TOTAL_STARS = MODULE_IDS.length * MAX_STARS;

/** Stars earned across the whole path. */
export const starsEarned = (progress: string | undefined): number =>
  MODULE_IDS.reduce((sum, id) => sum + starsFor(progress, id), 0);

/**
 * The flame's size, from a first spark to a blaze.
 *
 * **Never zero.** Somebody arriving with nothing still gets a small flame,
 * because an empty screen that lights up only after you have achieved
 * something rewards the people who least need rewarding and greets everybody
 * else with a void. The spark is the invitation; the growth is the encouragement.
 *
 * Eased rather than linear, and deliberately front-loaded: the jump from
 * nothing to one star is the largest visible change in the whole path. That
 * is the moment somebody decides whether this was worth opening, and it is
 * worth more than the difference between thirty and thirty-one stars.
 */
export const SPARK = 0.22;

export function flameHeat(progress: string | undefined): number {
  const earned = starsEarned(progress);
  if (earned <= 0) return SPARK;
  const share = Math.min(1, earned / TOTAL_STARS);
  /* sqrt: fast early, gentle later. See the note above about the first star. */
  return SPARK + (1 - SPARK) * Math.sqrt(share);
}

/**
 * What to call it, for the caption under the flame and for screen readers.
 *
 * A flame with no words is a mood; a flame with a name is feedback. The names
 * escalate in a way somebody can feel they are climbing without any of them
 * being an insult at the bottom — nobody is told their fire is pathetic.
 */
export type FlameStage = 'spark' | 'kindling' | 'burning' | 'roaring' | 'inferno';

export function flameStage(progress: string | undefined): FlameStage {
  const earned = starsEarned(progress);
  if (earned === TOTAL_STARS) return 'inferno';
  const share = earned / TOTAL_STARS;
  if (share <= 0) return 'spark';
  if (share < 0.25) return 'kindling';
  if (share < 0.6) return 'burning';
  return 'roaring';
}

const WORDS: Record<FlameStage, string> = {
  spark: 'A spark',
  kindling: 'Catching',
  burning: 'Burning',
  roaring: 'Roaring',
  inferno: 'An inferno',
};

export const flameLabel = (stage: FlameStage): string => WORDS[stage];
