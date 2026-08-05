import { describe, expect, it } from 'vitest';
import {
  flameFrame, flameFrames, flameHeat, flameLabel, flameStage, flameTone, SHAPES,
  SPARK, sparksFor, SPRITE_FRAMES, SPRITE_H, SPRITE_W, starsEarned, TOTAL_STARS,
} from '../flame';
import { MAX_STARS, MODULE_IDS } from '../learnPath';

const STAGES = ['spark', 'kindling', 'burning', 'roaring', 'inferno'] as const;

const everything = '3'.repeat(MODULE_IDS.length);

describe('stars across the path', () => {
  it('counts every star, not every module', () => {
    expect(TOTAL_STARS).toBe(MODULE_IDS.length * MAX_STARS);
    expect(starsEarned('31')).toBe(4);
    expect(starsEarned(everything)).toBe(TOTAL_STARS);
  });

  it('reads nothing as nothing', () => {
    expect(starsEarned(undefined)).toBe(0);
    expect(starsEarned('')).toBe(0);
  });
});

describe('the flame', () => {
  /**
   * The invitation. A screen that lights up only once you have achieved
   * something rewards the people who least need it and greets everybody else
   * with a void.
   */
  it('still burns for somebody who has done nothing', () => {
    expect(flameHeat(undefined)).toBe(SPARK);
    expect(flameHeat(undefined)).toBeGreaterThan(0);
  });

  it('grows with every star, not only with every module', () => {
    const one = flameHeat('1');
    const two = flameHeat('2');
    const three = flameHeat('3');
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
  });

  it('never shrinks as the path is walked', () => {
    let previous = 0;
    for (let stars = 0; stars <= MODULE_IDS.length; stars += 1) {
      const heat = flameHeat('3'.repeat(stars));
      expect(heat).toBeGreaterThanOrEqual(previous);
      previous = heat;
    }
  });

  it('reaches full height only when everything is mastered', () => {
    expect(flameHeat(everything)).toBeCloseTo(1);
    expect(flameHeat('1'.repeat(MODULE_IDS.length))).toBeLessThan(1);
  });

  it('stays within its bounds even if the server grew a level', () => {
    const heat = flameHeat('9'.repeat(MODULE_IDS.length + 6));
    expect(heat).toBeLessThanOrEqual(1);
    expect(heat).toBeGreaterThanOrEqual(SPARK);
  });

  /**
   * Front-loaded on purpose: nothing-to-one-star is the moment somebody
   * decides whether this was worth opening, and it is worth more than the
   * difference between thirty and thirty-one.
   */
  it('grows fastest at the start, where the encouragement matters most', () => {
    const firstStep = flameHeat('1') - flameHeat(undefined);
    const lateStep = flameHeat(`${'3'.repeat(10)}1`) - flameHeat('3'.repeat(10));
    expect(firstStep).toBeGreaterThan(lateStep);
  });
});

describe('what it is called', () => {
  it('names a new player a spark rather than an insult', () => {
    expect(flameStage(undefined)).toBe('spark');
    expect(flameLabel('spark')).toBe('A spark');
  });

  it('climbs through the stages as the path is walked', () => {
    expect(flameStage('1')).toBe('kindling');
    expect(flameStage('333333')).toBe('burning');
    expect(flameStage('33333333333')).toBe('roaring');
  });

  /** Reserved for a fully mastered path, so it means something. */
  it('saves the inferno for every star on the board', () => {
    expect(flameStage(everything)).toBe('inferno');
    expect(flameStage('3'.repeat(MODULE_IDS.length - 1))).not.toBe('inferno');
  });

  it('has a word for every stage', () => {
    for (const stage of ['spark', 'kindling', 'burning', 'roaring', 'inferno'] as const) {
      expect(flameLabel(stage).length).toBeGreaterThan(0);
    }
  });
});

describe('the sprite', () => {
  const frames = flameFrames();

  it('draws every frame on the same grid', () => {
    expect(frames).toHaveLength(SPRITE_FRAMES);
    for (const frame of frames) {
      expect(frame).toHaveLength(SPRITE_H);
      for (const row of frame) expect(row).toHaveLength(SPRITE_W);
    }
  });

  it('uses only the three bands and empty space', () => {
    for (const row of frames.flat()) expect(row).toMatch(/^[.123]*$/);
  });

  /** Deterministic, so the loop never stutters into an odd shape. */
  it('draws the same frame the same way every time', () => {
    expect(flameFrame(3)).toEqual(flameFrame(3));
  });

  it('is a flame shape: narrow at the tip, wide at the base', () => {
    for (const frame of frames) {
      const lit = (row: string) => row.length - row.split('').filter((c) => c === '.').length;
      expect(lit(frame[1])).toBeLessThan(lit(frame[SPRITE_H - 3]));
    }
  });

  it('never draws an empty frame', () => {
    for (const frame of frames) expect(frame.join('')).toMatch(/[123]/);
  });

  /** The contrast that makes it read as hot rather than as a coloured blob. */
  it('keeps a core inside a body inside an edge', () => {
    const widest = frames[0][SPRITE_H - 4];
    expect(widest).toContain('3');
    expect(widest).toContain('2');
    expect(widest).toContain('1');
    /* Outer band on both ends, core in the middle. */
    expect(widest.trim().startsWith('.') || widest.includes('1')).toBe(true);
  });

  it('moves between frames, or it is not an animation', () => {
    const distinct = new Set(frames.map((frame) => frame.join('\n')));
    expect(distinct.size).toBeGreaterThan(SPRITE_FRAMES / 2);
  });

  /**
   * Fire is anchored: the tip leans, the base does not wander. Measured on
   * `inferno`, the only stage that reaches the top of the grid — every other
   * stage leaves empty rows up there and would compare two blanks.
   */
  it('holds the base still while the tip moves', () => {
    const tall = flameFrames('inferno');
    const base = tall.map((frame) => frame[SPRITE_H - 2]);
    const tips = tall.map((frame) => frame[3]);
    expect(new Set(base).size).toBeLessThan(new Set(tips).size);
  });
});

/**
 * A bigger fire is a different fire, not a zoomed one. This is the difference
 * between the flame growing and the flame being resized, and it is the whole
 * reason each stage has its own silhouette.
 */
describe('the stages are different fires', () => {
  it('gives every stage a shape', () => {
    for (const stage of STAGES) expect(SHAPES[stage]).toBeDefined();
  });

  const lit = (frame: string[]) =>
    frame.join('').split('').filter((c) => c !== '.').length;

  it('grows taller and denser from ember to inferno', () => {
    let previousReach = 0;
    let previousLit = 0;
    for (const stage of STAGES) {
      const shape = SHAPES[stage];
      expect(shape.reach).toBeGreaterThan(previousReach);
      previousReach = shape.reach;

      const cells = lit(flameFrame(0, stage));
      expect(cells).toBeGreaterThan(previousLit);
      previousLit = cells;
    }
  });

  /** Fire grows taller faster than it grows wider, or it is just a cone. */
  it('gains more height than width across the range', () => {
    const first = SHAPES.spark;
    const last = SHAPES.inferno;
    expect(last.reach / first.reach).toBeGreaterThan(last.girth / first.girth);
  });

  /** A coal barely licks; a blaze tears. */
  it('gets more ragged as it gets hotter', () => {
    let previous = -1;
    for (const stage of STAGES) {
      expect(SHAPES[stage].lick).toBeGreaterThan(previous);
      previous = SHAPES[stage].lick;
    }
  });

  it('opens the hot core up as the fire gets hotter', () => {
    expect(SHAPES.inferno.core).toBeGreaterThan(SHAPES.spark.core);
  });

  it('draws a visibly different sprite per stage', () => {
    const shapes = STAGES.map((stage) => flameFrame(0, stage).join('|'));
    expect(new Set(shapes).size).toBe(STAGES.length);
  });

  /** An ember is a coal: squat, and nowhere near the top of the grid. */
  it('keeps the ember low', () => {
    const frame = flameFrame(0, 'spark');
    const filled = frame.findIndex((row) => /[123]/.test(row));
    expect(filled).toBeGreaterThan(SPRITE_H / 2);
  });
});

describe('colour', () => {
  /**
   * The board's flame is an earned status marker — gold means a rating of 450,
   * ground out in ranked duels. This one is a backdrop nobody else ever sees.
   * Handing out that gold for finishing a beginner's tutorial would cheapen the
   * one somebody ground for, so the path takes fire's own temperature scale and
   * leaves the board's colours alone.
   */
  it('climbs red to orange to blue to white, as fire does', () => {
    expect(flameTone('spark')).toBe('coal');
    expect(flameTone('kindling')).toBe('coal');
    expect(flameTone('burning')).toBe('amber');
    expect(flameTone('roaring')).toBe('azure');
    expect(flameTone('inferno')).toBe('white');
  });

  /** The peak is white heat, never the leaderboard's gold. */
  it('never awards the gold the leaderboard grants', () => {
    const tones = STAGES.map(flameTone);
    expect(tones).not.toContain('gold');
    expect(tones[tones.length - 1]).toBe('white');
  });

  it('reserves the hottest tone for a fully mastered path', () => {
    expect(STAGES.filter((stage) => flameTone(stage) === 'white')).toEqual(['inferno']);
  });
});

describe('sparks', () => {
  /** A coal does not throw sparks, and their arrival is itself a reward. */
  it('gives none to the small fires', () => {
    expect(sparksFor('spark')).toHaveLength(0);
    expect(sparksFor('kindling')).toHaveLength(0);
  });

  it('starts at burning and grows from there', () => {
    let previous = 0;
    for (const stage of ['burning', 'roaring', 'inferno'] as const) {
      const count = sparksFor(stage).length;
      expect(count).toBeGreaterThan(previous);
      previous = count;
    }
  });

  it('is deterministic, so every render draws the same fire', () => {
    expect(sparksFor('inferno')).toEqual(sparksFor('inferno'));
  });

  it('keeps every spark on the sprite grid', () => {
    for (const spark of sparksFor('inferno')) {
      expect(spark.x).toBeGreaterThanOrEqual(0);
      expect(spark.x).toBeLessThanOrEqual(SPRITE_W);
      expect(spark.rise).toBeGreaterThan(0);
      expect(spark.delay).toBeGreaterThanOrEqual(0);
      expect(spark.delay).toBeLessThan(1);
    }
  });

  /** Spread rather than clustered, without needing a seed. */
  it('does not stack them all in one column', () => {
    const xs = sparksFor('inferno').map((s) => Math.round(s.x));
    expect(new Set(xs).size).toBeGreaterThan(3);
  });
});
