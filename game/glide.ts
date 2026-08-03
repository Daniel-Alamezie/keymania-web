/**
 * Easing for the typing stream.
 *
 * Pulled out of the component because the framerate-independence is a claim
 * about maths, not about React, and it is the kind of claim that is quietly
 * wrong for years: get it subtly off and the text drifts at a different speed on
 * a 120Hz display than on a 60Hz one, which nobody notices until someone with
 * the other monitor says the game "feels weird" and cannot say why.
 *
 * **A critically damped spring, not an exponential lerp.** The lerp covered a
 * fixed fraction of the remaining gap each frame, which means its velocity is
 * highest at the instant the target moves and decays from there. One keystroke
 * looks fine. Typing is not one keystroke: at speed the target jumps every
 * eighty milliseconds, so the strip was restarting that decay over and over and
 * the motion was a run of small pops rather than one continuous drift.
 *
 * A spring carries velocity across those jumps. Already moving when the next
 * character lands, it keeps moving, and the retarget bends the path instead of
 * restarting it — which is the whole of the smoothness difference. It also
 * starts from rest rather than snapping, so the first character after a pause
 * eases in instead of lurching.
 */

/**
 * Stiffness, in radians per second.
 *
 * Critically damped, so this is the only knob: higher is tighter and faster,
 * lower is looser and laggier. At 20 the strip covers 90% of a jump in about
 * 195ms, against roughly 172ms for the lerp this replaced — near enough that
 * the caret does not visibly trail the fingers, while the velocity profile is
 * gentle at both ends instead of only at the far one.
 *
 * Below about 12 fast typists outrun it and the caret drags. Above about 30 it
 * is stiff enough to be a step again, which is what this exists to avoid.
 */
export const OMEGA = 20;

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
 * And below this it is no longer travelling anywhere worth waiting for.
 *
 * Position alone is not enough to stop on: a spring passing through its target
 * at speed is momentarily within a quarter pixel of it while still moving, and
 * halting there would clip the motion short and look like a snag.
 */
const SETTLE_VELOCITY = 1;

export interface Glide {
  position: number;
  /** Pixels per second. Carried between frames; that is the point. */
  velocity: number;
}

export const atRest = (position: number): Glide => ({ position, velocity: 0 });

/**
 * Advance the spring by a frame of `elapsedMs`.
 *
 * The closed-form solution of a critically damped spring rather than a
 * numerical integration, which is what keeps it exactly framerate-independent:
 * two 16ms steps and one 32ms step land in the same place because both are
 * evaluating the same continuous function at the same instant, not accumulating
 * error at different rates.
 *
 * For displacement `d` from the target and velocity `v`:
 *   d(t) = (d + (v + omega*d) * t) * e^(-omega*t)
 */
export function step(state: Glide, target: number, elapsedMs: number): Glide {
  const drift = state.position - target;

  if (Math.abs(drift) <= SETTLE_PX && Math.abs(state.velocity) <= SETTLE_VELOCITY) {
    return { position: target, velocity: 0 };
  }

  const dt = Math.min(elapsedMs, MAX_FRAME_MS) / 1000;
  const decay = Math.exp(-OMEGA * dt);
  // The coefficient that makes the solution honour the velocity it starts with.
  const c = state.velocity + OMEGA * drift;

  return {
    position: target + (drift + c * dt) * decay,
    velocity: (state.velocity - c * OMEGA * dt) * decay,
  };
}
