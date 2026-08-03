import { describe, expect, it } from 'vitest';
import { atRest, OMEGA, step, type Glide } from '../glide';

/**
 * The easing under the typing stream.
 *
 * Every claim here is about maths rather than about React, which is why it is
 * testable at all — and why it is worth testing. Framerate independence in
 * particular is the kind of thing that stays quietly wrong for years: get it
 * subtly off and the text drifts at a different speed on a 120Hz display than
 * on a 60Hz one, and the only symptom is somebody saying the game feels weird
 * on their monitor and being unable to say why.
 */

const FRAME = 1000 / 60;

/** Run the spring for `ms` in frames of `frameMs`, and report where it got to. */
function run(from: Glide, target: number, ms: number, frameMs = FRAME): Glide {
  let state = from;
  for (let t = 0; t < ms; t += frameMs) state = step(state, target, frameMs);
  return state;
}

describe('glide', () => {
  it('always moves toward the target, never past it', () => {
    let state = atRest(0);
    let previous = state.position;
    for (let i = 0; i < 10; i += 1) {
      state = step(state, 100, FRAME);
      expect(state.position).toBeGreaterThan(previous);
      expect(state.position).toBeLessThanOrEqual(100);
      previous = state.position;
    }
  });

  it('runs backwards just as well', () => {
    // Deleting a character walks the caret left, so the gap can be negative.
    let state = atRest(100);
    let previous = state.position;
    for (let i = 0; i < 10; i += 1) {
      state = step(state, 0, FRAME);
      expect(state.position).toBeLessThan(previous);
      expect(state.position).toBeGreaterThanOrEqual(0);
      previous = state.position;
    }
  });

  /**
   * **The claim the whole file exists for.** The closed form is evaluated at an
   * instant rather than integrated step by step, so splitting a frame in two
   * must land in exactly the same place — otherwise a player on better hardware
   * watches the text move at a different speed.
   */
  it('lands in the same place regardless of framerate', () => {
    const at30 = run(atRest(0), 100, 300, 1000 / 30);
    const at60 = run(atRest(0), 100, 300, FRAME);
    const at120 = run(atRest(0), 100, 300, 1000 / 120);

    expect(at60.position).toBeCloseTo(at30.position, 6);
    expect(at120.position).toBeCloseTo(at30.position, 6);
    expect(at120.velocity).toBeCloseTo(at30.velocity, 4);
  });

  /**
   * A backgrounded tab stops painting entirely, so the frame you return on can
   * be arbitrarily long. Uncapped, that single frame would consume the whole
   * distance and the smoothing would vanish exactly when it is being watched.
   */
  it('caps how much a single stalled frame can swallow', () => {
    const afterAStall = step(atRest(0), 100, 60_000);
    expect(afterAStall.position).toBeLessThan(100);
    // Identical to the longest honoured frame, however long the stall was.
    expect(afterAStall.position).toBeCloseTo(step(atRest(0), 100, 64).position, 6);
  });

  it('settles exactly rather than creeping for ever', () => {
    const settled = run(atRest(0), 100, 2000);
    expect(settled.position).toBe(100);
    expect(settled.velocity).toBe(0);
    // Without this the loop writes a new transform every frame, for ever, over
    // a distance no display can show.
    expect(step(atRest(100), 100, FRAME).position).toBe(100);
  });

  /**
   * **Position alone is not enough to stop on.**
   *
   * A spring travelling at speed passes within a quarter pixel of its target
   * while still moving. Settling there would clip the motion short and read as
   * a snag, so the velocity has to be spent too.
   */
  it('does not settle while still travelling through the target', () => {
    const flying = step({ position: 99.9, velocity: 600 }, 100, FRAME);
    expect(flying.position).not.toBe(100);
  });

  /**
   * **The reason this is a spring and not a lerp.**
   *
   * A lerp's velocity is highest the instant the target moves and decays from
   * there, so at speed — where the target jumps every eighty milliseconds — the
   * strip restarted that decay over and over and the motion was a run of small
   * pops. A spring is already moving when the next character lands, and the
   * retarget bends its path rather than restarting it.
   */
  it('carries momentum through a retarget', () => {
    const moving = run(atRest(0), 200, 100);
    expect(moving.velocity).toBeGreaterThan(0);

    // Both now aim at a new target from the same place; only one has speed.
    const withSpeed = step({ ...moving }, 400, FRAME);
    const fromRest = step({ position: moving.position, velocity: 0 }, 400, FRAME);
    expect(withSpeed.position).toBeGreaterThan(fromRest.position);
  });

  /** From rest it eases in. A lerp's largest move is its first; this one's is not. */
  it('begins gently instead of at full speed', () => {
    const first = step(atRest(0), 100, FRAME);
    const second = step(first, 100, FRAME);
    expect(second.position - first.position).toBeGreaterThan(first.position);
  });

  /**
   * Critically damped, so it must not oscillate. A line of text that sails past
   * its mark and comes back reads as a wobble, which is worse than the pops
   * this replaced.
   */
  it('settles from one side rather than bouncing', () => {
    let state: Glide = atRest(0);
    let crossings = 0;
    let side = Math.sign(0 - 100);
    for (let i = 0; i < 200; i += 1) {
      state = step(state, 100, FRAME);
      const now = Math.sign(state.position - 100);
      if (now !== 0 && now !== side) { crossings += 1; side = now; }
    }
    expect(crossings).toBe(0);
    expect(state.position).toBe(100);
  });

  it('keeps a stiffness a fast typist cannot outrun', () => {
    // 90% of a jump inside a fifth of a second. Slower and the caret drags.
    expect(run(atRest(0), 100, 200).position).toBeGreaterThan(90);
    expect(OMEGA).toBeGreaterThanOrEqual(12);
  });
});
