/**
 * The forge cools, as the client draws it.
 *
 * A mirror of `src/lib/heat.ts` in keymania-api, which owns the truth. The
 * server ends a run; this exists so the bar can empty smoothly between words
 * instead of jumping only when a message arrives, the same way the arena
 * predicts a blade's damage before the referee confirms it.
 *
 * The two repos deploy separately and cannot share code, so the constants are
 * written out on both sides and pinned literally by a test on each. A drift here
 * is quiet in the worst way: the bar would empty at one rate while the run ended
 * at another, and a player would die with time visibly left.
 */

/** Milliseconds of heat granted per character typed, including the space. */
export const MS_PER_CHAR = 280;

/** The most heat the forge will hold. */
export const CAPACITY_MS = 6_000;

/** Words survived per 1x of extra cooling. Lower is crueller. */
export const COOL_PER_WORDS = 90;

/** How fast the forge is cooling, having survived this many words. */
export function coolingFor(wordsSurvived: number): number {
  return 1 + Math.max(0, wordsSurvived) / COOL_PER_WORDS;
}

/** Heat granted by a word of this many characters. */
export function stokeFor(characters: number): number {
  return Math.max(0, characters) * MS_PER_CHAR;
}

/** The speed a player must hold to survive at this point. */
export function requiredWpm(wordsSurvived: number): number {
  return Math.round((60_000 / (5 * MS_PER_CHAR)) * coolingFor(wordsSurvived));
}

/**
 * How full the forge is, from 0 to 1.
 *
 * The bar's width and its `aria-valuenow` both want this, and both used to do
 * their own arithmetic on `heat` directly, so a `NaN` off the wire became a
 * `width: NaN%` the browser silently dropped and an announced value of `NaN`.
 * Neither crashed, which is worse: the bar simply sat at whatever width it had
 * and the run looked fine while its clock was gone.
 */
export function heatFraction(heat: number): number {
  if (!Number.isFinite(heat)) return 0;
  return Math.max(0, Math.min(1, heat / CAPACITY_MS));
}

/**
 * How long the bar has left, in real seconds, at the current cooling.
 *
 * Heat is stored as milliseconds of *typing* rather than of clock, because it is
 * spent faster than real time as the run goes on. This converts one to the other
 * so the bar can be animated over an actual duration.
 *
 * Never negative, because a bar cannot be less than empty, and **never `NaN`**,
 * because its only caller feeds the answer straight to `element.animate()` and
 * that throws on a duration it cannot use. It threw for real: the server was
 * sending the judgement nested a level down, `heat` arrived as `undefined`,
 * `Math.max(0, undefined)` is `NaN`, and `NaN <= 0` is false, so every guard
 * downstream waved it through and the run screen died on the first word.
 *
 * The server bug is fixed and so is the reducer that accepted it. This is the
 * third line of the same defence, and it is the one that turns any future
 * version of that mistake into a bar that stops moving rather than a game that
 * stops running.
 */
export function secondsLeft(heat: number, wordsSurvived: number): number {
  if (!Number.isFinite(heat) || !Number.isFinite(wordsSurvived)) return 0;
  return Math.max(0, heat) / coolingFor(wordsSurvived) / 1000;
}
