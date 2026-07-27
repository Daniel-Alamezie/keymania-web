import { describe, expect, it } from 'vitest';
import { GLIDE, step } from '../glide';

describe('glide', () => {
  it('covers the configured fraction of the gap in one 60Hz frame', () => {
    expect(step(0, 100, 1000 / 60)).toBeCloseTo(100 * GLIDE, 6);
  });

  it('always moves toward the target, never past it', () => {
    let position = 0;
    for (let i = 0; i < 10; i++) {
      const next = step(position, 100, 1000 / 60);
      expect(next).toBeGreaterThan(position);
      expect(next).toBeLessThanOrEqual(100);
      position = next;
    }
  });

  it('runs backwards just as well', () => {
    // Deleting a character walks the caret left, so the gap can be negative.
    expect(step(100, 0, 1000 / 60)).toBeCloseTo(100 * (1 - GLIDE), 6);
  });

  /**
   * The reason the easing is exponential rather than linear. A player on a
   * 120Hz monitor gets twice the frames, and each has to do half the work —
   * otherwise the text visibly drifts faster on better hardware.
   */
  it('lands in the same place regardless of framerate', () => {
    const oneLongFrame = step(0, 100, 1000 / 30);

    let stepped = 0;
    for (let i = 0; i < 2; i++) stepped = step(stepped, 100, 1000 / 60);

    expect(stepped).toBeCloseTo(oneLongFrame, 6);

    let fast = 0;
    for (let i = 0; i < 4; i++) fast = step(fast, 100, 1000 / 120);
    expect(fast).toBeCloseTo(oneLongFrame, 6);
  });

  /**
   * A backgrounded tab stops painting entirely, so the frame you return on can
   * be arbitrarily long. Uncapped, that single frame would consume the whole
   * distance and the smoothing would vanish exactly when it is being watched.
   */
  it('caps how much a single stalled frame can swallow', () => {
    const afterAStall = step(0, 100, 60_000);
    expect(afterAStall).toBeLessThan(100);
    // Identical to the longest honoured frame, however long the stall was.
    expect(afterAStall).toBeCloseTo(step(0, 100, 64), 6);
  });

  it('settles exactly rather than creeping for ever', () => {
    expect(step(99.9, 100, 1000 / 60)).toBe(100);
    // Without this the loop writes a new transform every frame, for ever, over
    // a distance no display can show.
    expect(step(100, 100, 1000 / 60)).toBe(100);
  });
});
