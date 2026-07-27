/**
 * Easing for the typing stream.
 *
 * Pulled out of the component because the framerate-independence is a claim
 * about maths, not about React, and it is the kind of claim that is quietly
 * wrong for years: get it subtly off and the text drifts at a different speed on
 * a 120Hz display than on a 60Hz one, which nobody notices until someone with
 * the other monitor says the game "feels weird" and cannot say why.
 */

/**
 * Fraction of the remaining distance covered per frame at 60Hz.
 *
 * Low enough to read as a drift rather than a jump, high enough that the caret
 * never visibly trails the fingers. Around 0.2 the text settles in roughly a
 * tenth of a second — slower and fast typists outrun it, faster and it is a step
 * again.
 */
export const GLIDE = 0.2;

/** One frame at 60Hz, the rate GLIDE is expressed against. */
const BASE_FRAME_MS = 1000 / 60;

/**
 * Longest frame the easing will honour.
 *
 * A backgrounded tab stops painting, so the first frame after returning can be
 * seconds long. Without a ceiling that one frame would eat the whole remaining
 * distance and the smoothing would be pointless exactly when the player is
 * looking again.
 */
const MAX_FRAME_MS = 64;

/** Below this the movement is invisible, so it settles exactly instead. */
const SETTLE_PX = 0.25;

/**
 * Ease `position` toward `target` for a frame of `elapsedMs`.
 *
 * Exponential rather than linear: covering a *fraction* of what is left each
 * frame is what makes it independent of framerate. Two 16ms frames and one 32ms
 * frame land in the same place, because (1-k) compounds either way.
 */
export function step(position: number, target: number, elapsedMs: number): number {
  const drift = target - position;
  if (Math.abs(drift) <= SETTLE_PX) return target;

  const frames = Math.min(elapsedMs, MAX_FRAME_MS) / BASE_FRAME_MS;
  const k = 1 - (1 - GLIDE) ** frames;
  return position + drift * k;
}
