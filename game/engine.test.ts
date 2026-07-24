import { describe, expect, it } from 'vitest';
import {
  applyDamage, bladeTier, comboMultiplier, keepsCombo, scoreWord, speedMultiplier, toWords, wordIndexAt, wpmFor,
} from './engine';
import { COMBO_WINDOW_MS, MAX_COMBO_MULTIPLIER, MAX_SPEED_MULTIPLIER, MIN_SPEED_MULTIPLIER } from './constants';

describe('wpmFor', () => {
  it('treats five characters as one word', () => {
    // 5 chars in 1 second => 1 word in 1/60 min => 60 wpm
    expect(Math.round(wpmFor(5, 1000))).toBe(60);
  });

  it('is zero for a non-positive duration', () => {
    expect(wpmFor(10, 0)).toBe(0);
  });
});

describe('speedMultiplier', () => {
  it('clamps at both ends', () => {
    expect(speedMultiplier(0)).toBe(MIN_SPEED_MULTIPLIER);
    expect(speedMultiplier(400)).toBe(MAX_SPEED_MULTIPLIER);
  });

  it('rises with typing speed', () => {
    expect(speedMultiplier(80)).toBeGreaterThan(speedMultiplier(40));
  });
});

describe('comboMultiplier', () => {
  it('starts neutral and is capped', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(999)).toBe(MAX_COMBO_MULTIPLIER);
  });
});

describe('bladeTier', () => {
  it('escalates with the combo and never exceeds tier 5', () => {
    expect(bladeTier(0)).toBe(1);
    expect(bladeTier(2)).toBe(2);
    expect(bladeTier(4)).toBe(3);
    expect(bladeTier(6)).toBe(4);
    expect(bladeTier(9)).toBe(5);
    expect(bladeTier(100)).toBe(5);
  });
});

describe('keepsCombo', () => {
  it('holds inside the window and drops outside it', () => {
    expect(keepsCombo(COMBO_WINDOW_MS - 1)).toBe(true);
    expect(keepsCombo(COMBO_WINDOW_MS + 1)).toBe(false);
  });
});

describe('scoreWord', () => {
  it('increments the combo and reports the resulting tier', () => {
    const result = scoreWord({ characters: 4, elapsedMs: 500, combo: 1 });
    expect(result.combo).toBe(2);
    expect(result.tier).toBe(bladeTier(2));
  });

  it('flags the moment a new blade tier is forged', () => {
    // combo 1 -> 2 crosses into tier 2
    expect(scoreWord({ characters: 4, elapsedMs: 500, combo: 1 }).tierUp).toBe(true);
    // combo 2 -> 3 stays in tier 2
    expect(scoreWord({ characters: 4, elapsedMs: 500, combo: 2 }).tierUp).toBe(false);
  });

  it('rewards a faster run of the same word', () => {
    const fast = scoreWord({ characters: 5, elapsedMs: 300, combo: 0 });
    const slow = scoreWord({ characters: 5, elapsedMs: 1500, combo: 0 });
    expect(fast.damage).toBeGreaterThan(slow.damage);
  });

  it('rewards a longer combo at identical speed', () => {
    const chained = scoreWord({ characters: 5, elapsedMs: 500, combo: 6 });
    const fresh = scoreWord({ characters: 5, elapsedMs: 500, combo: 0 });
    expect(chained.damage).toBeGreaterThan(fresh.damage);
  });

  it('keeps a single hit within a sane damage band', () => {
    // Guards the balance: no single word should ever come close to a one-shot.
    const best = scoreWord({ characters: 12, elapsedMs: 200, combo: 50 });
    expect(best.damage).toBeLessThan(10);
  });
});

describe('applyDamage', () => {
  it('never drops below zero', () => {
    expect(applyDamage(3, 10)).toBe(0);
    expect(applyDamage(10, 2.5)).toBe(7.5);
  });
});

describe('sentence helpers', () => {
  it('splits words with their start offsets', () => {
    expect(toWords('the cat sat')).toEqual([
      { text: 'the', start: 0 },
      { text: 'cat', start: 4 },
      { text: 'sat', start: 8 },
    ]);
  });

  it('maps a cursor back to its word', () => {
    expect(wordIndexAt('the cat sat', 0)).toBe(0);
    expect(wordIndexAt('the cat sat', 5)).toBe(1);
    expect(wordIndexAt('the cat sat', 9)).toBe(2);
  });
});
