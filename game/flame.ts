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

/* ------------------------------------------------------------ the sprite */

/**
 * The flame's shape, generated rather than hand-drawn.
 *
 * The first pixel version was three authored frames, and it read as static —
 * three frames is a jitter, not a fire. Authoring twelve by hand would have
 * fixed that and made the shape unmaintainable, so the silhouette comes from a
 * curve instead and the pixels are quantised out of it.
 *
 * That buys two things the authored version could not have. **Rounded**,
 * because the outline follows a smooth function and only becomes blocky at the
 * grid, which is what pixel art actually is — a curve sampled coarsely, not a
 * shape drawn out of squares. And **fluid**, because the number of frames is
 * now a constant rather than an afternoon.
 *
 * Deterministic: frame `n` always produces the same cells. No randomness, so
 * this is testable and the animation never stutters into an odd shape.
 */
export const SPRITE_W = 15;
export const SPRITE_H = 22;
/** Enough that the cycle reads as motion rather than as a flicker of three. */
export const SPRITE_FRAMES = 8;

/** How far the tip leans, in cells, at its widest. */
const SWING = 1.9;

/**
 * Half the flame's width at a given depth, in cells.
 *
 * `u` is 0 at the tip and 1 at the base. Widest around two-thirds down and
 * drawn back in slightly at the very bottom, which is what stops a flame
 * reading as a triangle — fire narrows where it meets what it is burning.
 */
function halfWidth(u: number): number {
  const max = (SPRITE_W - 1) / 2;
  return max * Math.pow(u, 0.62) * (1 - 0.2 * Math.pow(u, 7));
}

/**
 * One frame, as rows of `.`, `1`, `2`, `3`.
 *
 * Bands come from how far across the flame a cell sits rather than from its
 * height, so the core is a column up the middle and the edge stays one cell
 * thick — the contrast that makes it read as hot.
 */
export function flameFrame(frame: number): string[] {
  const phase = (2 * Math.PI * frame) / SPRITE_FRAMES;
  const rows: string[] = [];

  for (let y = 0; y < SPRITE_H; y += 1) {
    const u = y / (SPRITE_H - 1);
    /* The tip moves most and the base not at all: fire is anchored. */
    const lean = SWING * Math.pow(1 - u, 2.1) * Math.sin(phase + u * 3.1);
    /* A slow pulse in overall height, so the whole shape breathes. */
    const breath = 1 + 0.06 * Math.sin(phase * 2);
    const centre = (SPRITE_W - 1) / 2 + lean;
    const hw = halfWidth(u) * breath;

    let row = '';
    for (let x = 0; x < SPRITE_W; x += 1) {
      const d = Math.abs(x - centre) / Math.max(hw, 0.0001);
      if (hw < 0.45 || d > 1) { row += '.'; continue; }
      if (d < 0.33) row += '3';
      else if (d < 0.7) row += '2';
      else row += '1';
    }
    rows.push(row);
  }

  return rows;
}

/** Every frame of the loop. */
export const flameFrames = (): string[][] =>
  Array.from({ length: SPRITE_FRAMES }, (_, i) => flameFrame(i));
