import { describe, expect, it } from 'vitest';
import { ARENA_FX, asFx, FX_IDS, nextFx, type FxId } from '../arenaFx';

/**
 * The arena-treatment harness.
 *
 * Tested mainly for one property: **the control has to be today's arena, byte
 * for byte.** An experiment whose baseline has quietly drifted cannot tell you
 * anything, and the failure would be invisible — every treatment would look
 * better or worse than a thing nobody is actually running.
 */
describe('the control preset', () => {
  it('is the arena as it shipped, so the comparison means something', () => {
    expect(ARENA_FX.current).toEqual({
      id: 'current',
      label: 'As it is now',
      blurb: 'The control. Nothing changed.',
      // Shakes the whole screen, words included. This is the behaviour a player
      // called "so much going on", and it is the thing being measured against.
      shake: 'screen',
      shakeScale: 1,
      particles: 1,
      particleFloor: 1,
      trails: 3,
      arc: 0.16,
      loudFrom: 1,
      torches: 'flicker',
      danger: 'pulse',
      wpmEveryMs: 700,
    });
  });

  it('is what an absent or unknown preset resolves to', () => {
    expect(asFx(null)).toBe('current');
    expect(asFx(undefined)).toBe('current');
    expect(asFx('')).toBe('current');
    expect(asFx('calm')).toBe('current');
    expect(asFx('TRIM')).toBe('current');
  });
});

describe('asFx', () => {
  it('keeps every preset it recognises', () => {
    for (const id of FX_IDS) expect(asFx(id)).toBe(id);
  });
});

describe('the three treatments', () => {
  const variants = FX_IDS.filter((id) => id !== 'current');

  /**
   * Every knob, listed rather than derived by stripping the descriptive fields.
   * Spelling them out means adding a knob without deciding whether it belongs in
   * these comparisons is a visible omission instead of a silent inclusion.
   */
  const knobsOf = (id: FxId) => {
    const fx = ARENA_FX[id];
    return JSON.stringify([
      fx.shake, fx.shakeScale, fx.particles, fx.particleFloor,
      fx.trails, fx.arc, fx.loudFrom, fx.torches, fx.danger, fx.wpmEveryMs,
    ]);
  };

  /**
   * Each one has to differ from the control somewhere, or a tester is comparing
   * two identical screens and concluding there is no difference to be had.
   */
  it('each change something', () => {
    for (const id of variants) {
      expect(knobsOf(id)).not.toBe(knobsOf('current'));
    }
  });

  /** All three exist to answer the same complaint, so none may shake the text. */
  it('none of them shake the words', () => {
    for (const id of variants) expect(ARENA_FX[id].shake).not.toBe('screen');
  });

  /**
   * They are meant to be three different ideas rather than three volumes. If two
   * ever collapse onto the same settings, one of the three test slots is wasted.
   */
  it('are distinct from one another', () => {
    const shapes = variants.map(knobsOf);
    expect(new Set(shapes).size).toBe(variants.length);
  });

  it('are described, so the switcher can say what is being judged', () => {
    for (const id of FX_IDS) {
      expect(ARENA_FX[id].label.length).toBeGreaterThan(0);
      expect(ARENA_FX[id].blurb.length).toBeGreaterThan(0);
    }
  });

  /**
   * A burst can be thinned but never emptied, and debris must never be clipped
   * so high that it is gone before it leaves the fighter.
   */
  it('keep their knobs in sane ranges', () => {
    for (const id of FX_IDS) {
      const fx = ARENA_FX[id];
      expect(fx.particles).toBeGreaterThan(0);
      expect(fx.particleFloor).toBeGreaterThan(0.5);
      expect(fx.particleFloor).toBeLessThanOrEqual(1);
      expect(fx.trails).toBeGreaterThanOrEqual(0);
      expect(fx.arc).toBeGreaterThan(0);
      expect(fx.shakeScale).toBeGreaterThanOrEqual(0);
      if (fx.wpmEveryMs !== null) expect(fx.wpmEveryMs).toBeGreaterThan(0);
    }
  });
});

describe('nextFx', () => {
  it('walks the whole set and comes back round', () => {
    // Annotated, or TypeScript narrows to the literal 'current' from the tuple
    // index and refuses the reassignment below.
    let id: FxId = FX_IDS[0];
    const seen: FxId[] = [id];
    for (let i = 1; i < FX_IDS.length; i += 1) {
      id = nextFx(id);
      seen.push(id);
    }
    expect(seen).toEqual([...FX_IDS]);
    expect(nextFx(id)).toBe(FX_IDS[0]);
  });

  it('goes backwards too, wrapping the other way', () => {
    expect(nextFx(FX_IDS[0], -1)).toBe(FX_IDS[FX_IDS.length - 1]);
    expect(nextFx(FX_IDS[1], -1)).toBe(FX_IDS[0]);
  });
});
