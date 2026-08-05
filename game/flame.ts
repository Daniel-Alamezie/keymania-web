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
 * The flame's shape, generated per stage.
 *
 * **A bigger fire is a different fire, not a zoomed one.** The first version
 * scaled one sprite from small to large, and it read exactly like what it was:
 * a cone being resized. Real fire changes character as it grows — a coal
 * glowing dull red, a young flame that is all tongue and no body, a blaze with
 * a white heart and licks tearing off the top. So each stage gets its own
 * silhouette *and* its own palette, and growing along the path is a transition
 * between them rather than a scale factor.
 *
 * The silhouette comes from a curve so the outline stays rounded and only
 * becomes blocky where the grid samples it — which is what pixel art is, a
 * curve sampled coarsely rather than a shape built out of squares.
 *
 * Deterministic: frame `n` of stage `s` is always the same cells. Testable,
 * and the loop can never stutter into an odd shape.
 */
export const SPRITE_W = 19;
export const SPRITE_H = 26;
/** Enough that the cycle reads as motion rather than as a flicker of three. */
export const SPRITE_FRAMES = 8;

export interface FlameShape {
  /** How much of the grid's height the flame uses, 0 to 1. */
  reach: number;
  /** How much of the width at its widest, 0 to 1. */
  girth: number;
  /** How far the tip leans, in cells. */
  swing: number;
  /**
   * How ragged the edge is.
   *
   * The single most important number here. A flame with a smooth outline is a
   * cone; the notches and tongues are what the eye reads as *burning*.
   */
  lick: number;
  /** Share of the width taken by the hot core, 0 to 1. */
  core: number;
}

/**
 * Each stage's fire.
 *
 * An ember is squat, wide and barely licks at all — it is a coal, not a flame.
 * From there the fire grows *taller faster than it grows wider*, because that
 * is what fire does and because a flame that widened evenly would just be the
 * cone again. The core opens up as it gets hotter, so an inferno is mostly
 * white heart with a thin skin, and an ember is all skin with a dull middle.
 */
export const SHAPES: Record<FlameStage, FlameShape> = {
  spark: { reach: 0.30, girth: 0.62, swing: 0.5, lick: 0.30, core: 0.30 },
  kindling: { reach: 0.52, girth: 0.66, swing: 1.5, lick: 0.85, core: 0.34 },
  burning: { reach: 0.72, girth: 0.78, swing: 2.1, lick: 1.15, core: 0.42 },
  roaring: { reach: 0.88, girth: 0.88, swing: 2.6, lick: 1.45, core: 0.52 },
  inferno: { reach: 1.00, girth: 1.00, swing: 3.0, lick: 1.75, core: 0.62 },
};

/**
 * One frame of a stage, as rows of `.`, `1`, `2`, `3`.
 *
 * The width profile is a bulge rather than a taper: widest around two-thirds
 * down, drawn in at the very base where fire meets what it is burning, and
 * pinched at a waist above that. The waist is what stops it reading as a
 * triangle. Two harmonics of wobble ride on top so no two rows notch the same
 * way, which is the raggedness that makes it look alight.
 */
export function flameFrame(frame: number, stage: FlameStage = 'burning'): string[] {
  const shape = SHAPES[stage];
  const phase = (2 * Math.PI * frame) / SPRITE_FRAMES;
  const rows: string[] = [];

  const top = Math.round(SPRITE_H * (1 - shape.reach));
  const maxHalf = ((SPRITE_W - 1) / 2) * shape.girth;

  for (let y = 0; y < SPRITE_H; y += 1) {
    if (y < top) { rows.push('.'.repeat(SPRITE_W)); continue; }

    /* 0 at the tip, 1 at the base. */
    const u = (y - top) / Math.max(1, SPRITE_H - 1 - top);

    /* Belly two-thirds down, waist above it, drawn in at the base. */
    const belly = Math.pow(u, 0.82) * (1 + 0.42 * Math.sin(u * Math.PI * 1.15));
    const foot = 1 - 0.26 * Math.pow(u, 8);

    /*
     * Two harmonics, so the notches never line up into a smooth edge, damped
     * at both ends. A flame tapers to a point and sits flat where it meets its
     * fuel, so the licks belong to the flanks — letting them run to the tip is
     * what kept it blunt, and a blunt tip reads as a cone however ragged the
     * sides are.
     */
    const ragged = shape.lick * (
      0.6 * Math.sin(phase * 1.3 + u * 9.1)
      + 0.4 * Math.sin(phase * 2.1 + u * 15.7)
    ) * Math.pow(u, 0.5) * Math.pow(1 - u, 0.3);

    const hw = Math.max(0, maxHalf * belly * foot + ragged);

    /* The tip leans; the base is anchored, because fire is. */
    const lean = shape.swing * Math.pow(1 - u, 2.0) * Math.sin(phase + u * 2.6);
    const centre = (SPRITE_W - 1) / 2 + lean;

    let row = '';
    for (let x = 0; x < SPRITE_W; x += 1) {
      const d = Math.abs(x - centre) / Math.max(hw, 0.0001);
      if (hw < 0.5 || d > 1) { row += '.'; continue; }
      if (d < shape.core) row += '3';
      else if (d < 0.72) row += '2';
      else row += '1';
    }
    rows.push(row);
  }

  return rows;
}

/** Every frame of a stage's loop. */
export const flameFrames = (stage: FlameStage = 'burning'): string[][] =>
  Array.from({ length: SPRITE_FRAMES }, (_, i) => flameFrame(i, stage));
