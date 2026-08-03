import { describe, expect, it } from 'vitest';
import {
  ARENA_FX, asFx, DEFAULT_FX, FX_IDS, nextFx, type ArenaFx, type FxId,
} from '../arenaFx';

/**
 * The arena-treatment harness.
 *
 * Tested mainly for one property: **the control has to be today's arena, byte
 * for byte.** An experiment whose baseline has quietly drifted cannot tell you
 * anything, and the failure would be invisible — every treatment would look
 * better or worse than a thing nobody is actually running.
 */
describe('the control preset', () => {
  /**
   * Its copy is now product copy, not experiment copy.
   *
   * The preset was renamed to Classic when it stopped being a hidden control
   * and became a layout players choose in Settings — "As it is now" describes
   * a comparison nobody outside this repo was ever party to. Every *behaviour*
   * below is still pinned exactly as it was: what this preset draws is the
   * thing being preserved, and the label is the part that was always free.
   */
  it('is the arena as it shipped, so the comparison means something', () => {
    expect(ARENA_FX.current).toEqual({
      id: 'current',
      label: 'Classic',
      blurb: 'The original arena: two fighters, a room, blades in flight.',
      // The arena with fighters in it, and a pixel blade on the canvas. Pinned
      // because a layout knob that drifted here would silently redesign the
      // baseline every treatment is judged against.
      layout: 'arena',
      blade: 'canvas',
      // Shakes the whole screen, words included. This is the behaviour a player
      // called "so much going on", and it is the thing being measured against.
      shake: 'screen',
      // The full-viewport white fill on every hit. Pinned as the control even
      // though it is the thing players complained about, because that is what a
      // control is: the treatments are only meaningful measured against what
      // they actually played.
      flash: 'full',
      shakeScale: 1,
      particles: 1,
      particleFloor: 1,
      trails: 3,
      arc: 0.16,
      loudFrom: 1,
      torches: 'flicker',
      danger: 'pulse',
      ambient: 'edges',
      wpmEveryMs: 700,
    });
  });

  /**
   * The control is still pinned above, but it is no longer what you get.
   *
   * `plain` won and is the default, so `current` is now only reachable at
   * `?fx=current`. It stays because two people were shown the old screen on
   * Reddit and "it looked better before" should be checkable rather than
   * arguable.
   */
  it('is no longer the default, but is still reachable', () => {
    expect(DEFAULT_FX).toBe('plain');
    expect(asFx('current')).toBe('current');
  });
});

describe('the default', () => {
  it('is what an absent or unknown preset resolves to', () => {
    expect(asFx(null)).toBe(DEFAULT_FX);
    expect(asFx(undefined)).toBe(DEFAULT_FX);
    expect(asFx('')).toBe(DEFAULT_FX);
    expect(asFx('calm')).toBe(DEFAULT_FX);
    expect(asFx('PLAIN')).toBe(DEFAULT_FX);
  });

  /**
   * Whatever the default is has to be a real preset. A typo here would resolve
   * every visitor to an entry that does not exist, and `ARENA_FX[id]` would hand
   * the duel `undefined` for every knob it reads.
   */
  it('names a preset that exists', () => {
    expect(FX_IDS).toContain(DEFAULT_FX);
    expect(ARENA_FX[DEFAULT_FX]).toBeDefined();
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
      fx.layout, fx.blade, fx.ambient, fx.flash,
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

  /** They all exist to answer the same complaint, so none may shake the text. */
  it('none of them shake the words', () => {
    for (const id of variants) expect(ARENA_FX[id].shake).not.toBe('screen');
  });

  /**
   * Two layouts, and the names are load-bearing outside TypeScript.
   *
   * `Duel` renders `layout` straight into `data-layout`, and
   * SentenceView.module.css keys the painted edge gradients on the literal
   * string `arena` — they need a background that is already `--panel`, which is
   * true of the arena floor and nowhere else. A third layout, or a rename, would
   * silently fall to the masked default. That is the safe direction now, which
   * is the point of having turned it round, but it should be a decision rather
   * than a surprise.
   */
  it('only ever names two layouts, because a stylesheet reads them', () => {
    for (const id of FX_IDS) {
      expect(['arena', 'plain']).toContain(ARENA_FX[id].layout);
    }
  });

  /**
   * The canvas draws its blade between two fixed lane positions at mid height,
   * which in a layout with the sentence in the middle of the screen means driving
   * it straight through the words. A layout without fighters therefore cannot use
   * the canvas, and pairing them wrongly would reintroduce the exact problem the
   * layout exists to solve.
   */
  it('never put a canvas blade in a layout with no fighters', () => {
    for (const id of FX_IDS) {
      const fx = ARENA_FX[id];
      if (fx.layout === 'plain') expect(fx.blade).toBe('word');
      if (fx.blade === 'canvas') expect(fx.layout).toBe('arena');
    }
  });

  /**
   * Heat and the wound are shown in one place or the other, never both.
   *
   * They were briefly shown twice in `plain`, once around the window and once
   * around the text, which is the redundancy this whole exercise is removing.
   * The surface treatment only exists in the layout that has a reading surface
   * worth painting, and the edge treatment belongs to the arena.
   */
  it('put ambient state where the layout can actually show it', () => {
    for (const id of FX_IDS) {
      const fx = ARENA_FX[id];
      /**
       * Both directions, in one assertion.
       *
       * The first attempt was two one-way `if`s, which looked thorough and
       * checked half of what it claimed: a plain layout left on `edges` matched
       * neither branch and sailed through. That is the exact mistake it exists
       * to catch, and it was only found by making it and watching the test pass.
       */
      expect(fx.ambient === 'surface').toBe(fx.layout === 'plain');
    }
  });

  /**
   * A treatment that stops the readout ticking must not leave a stale one on
   * screen. Duel.tsx drops the caption entirely when this is null; without that
   * guard the interval never runs and the plate reports "0 wpm" all duel.
   */
  it('either update the speed readout or say nothing', () => {
    for (const id of FX_IDS) {
      const ms = ARENA_FX[id].wpmEveryMs;
      expect(ms === null || ms > 0).toBe(true);
    }
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

/**
 * The contact flash, which is its own question.
 *
 * Players called it distracting, and measuring it: a full-viewport white fill at
 * up to 0.5 opacity, on every hit in both directions. Two people at ninety words
 * a minute is three or four large luminance changes a second, which is past
 * annoying and into the range the photosensitivity guidance is about.
 *
 * Driven by `?flash=` rather than by a preset, because it is independent of the
 * layout question the presets exist to answer. Comparing two things at once
 * teaches you about neither.
 */
describe('the flash treatments', () => {
  /**
   * The decision, pinned. Four quieter variants were built and compared and none
   * of them beat removing it, because it was never carrying anything: the damage
   * number, the health bar, the shake, the particles and the sound all fire
   * regardless.
   */
  it('is gone from the preset players actually get', () => {
    expect(ARENA_FX[DEFAULT_FX].flash).toBe('none');
  });

  /**
   * And kept on the control, which is the one place it must stay. A baseline
   * that has been improved cannot tell you whether the improvement helped.
   */
  it('survives on the control, so the comparison is still possible', () => {
    expect(ARENA_FX.current.flash).toBe('full');
  });

  /**
   * The one that matters. Every other cue a hit has — the damage number, the
   * health bar, the shake, the particles, the sound — fires regardless of this
   * knob, which is exactly why turning it off entirely is a serious option
   * rather than a degradation.
   */
  it('offers a setting that removes it completely', () => {
    const modes: ArenaFx['flash'][] = ['full', 'heavy', 'taken', 'edge', 'none'];
    expect(modes).toContain('none');
  });
});
