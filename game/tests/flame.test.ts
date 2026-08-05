import { describe, expect, it } from 'vitest';
import {
  flameHeat, flameLabel, flameStage, SPARK, starsEarned, TOTAL_STARS,
} from '../flame';
import { MAX_STARS, MODULE_IDS } from '../learnPath';

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
