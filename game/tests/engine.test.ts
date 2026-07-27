import { describe, expect, it } from 'vitest';
import {
  applyDamage, bladeTier, comboMultiplier, keepsCombo, MIN_MS_PER_CHAR, sanitiseElapsed,
  scoreWord, speedMultiplier, toWords, wordIndexAt, wpmFor,
} from '../engine';
import {
  BASE_DAMAGE, COMBO_STEP, COMBO_WINDOW_MS, FAST_WPM, MAX_COMBO_MULTIPLIER,
  MAX_HEALTH, MAX_SPEED_MULTIPLIER, MIN_SPEED_MULTIPLIER, SLOW_WPM,
} from '../constants';

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

/**
 * The plausibility clamp.
 *
 * This lived only on the server, despite both files claiming to mirror each
 * other. The drift showed up twice: a peak-word figure of 1333 wpm — a whole
 * word in 36 milliseconds — and, less visibly, the client predicting damage for
 * a fast word that the server would then decline to award.
 */
describe('sanitiseElapsed', () => {
  it('floors an implausibly fast word at the humanly possible time', () => {
    // 4 characters cannot take 1ms; they are scored as 4 * MIN_MS_PER_CHAR.
    expect(sanitiseElapsed(4, 1)).toBe(4 * MIN_MS_PER_CHAR);
    expect(sanitiseElapsed(4, 36)).toBe(4 * MIN_MS_PER_CHAR);
  });

  it('leaves a believable duration alone', () => {
    expect(sanitiseElapsed(4, 800)).toBe(800);
  });

  it('treats missing or nonsense durations as the floor, not as instant', () => {
    expect(sanitiseElapsed(5, 0)).toBe(5 * MIN_MS_PER_CHAR);
    expect(sanitiseElapsed(5, -20)).toBe(5 * MIN_MS_PER_CHAR);
    expect(sanitiseElapsed(5, Number.NaN)).toBe(5 * MIN_MS_PER_CHAR);
  });

  it('caps a peak-word figure below anything a human could not reach', () => {
    // The clamp puts a hard ceiling on wpm regardless of word length:
    // 60000 / (5 * MIN_MS_PER_CHAR). Anything above it is an artefact.
    const ceiling = 60_000 / (5 * MIN_MS_PER_CHAR);
    for (const characters of [2, 4, 8, 15]) {
      const wpm = wpmFor(characters, sanitiseElapsed(characters, 1));
      expect(wpm).toBeCloseTo(ceiling, 5);
      expect(wpm).toBeLessThan(500);
    }
  });

  it('scores a suspiciously fast word as merely very fast', () => {
    // The 1333 wpm case: not rejected, just scored as the fastest a person
    // plausibly types, so neither the record nor the damage runs away.
    const scored = scoreWord({ characters: 4, elapsedMs: 36, combo: 0 });
    expect(scored.wpm).toBeLessThan(500);
  });
});

/**
 * The other half of the scoring contract.
 *
 * These same numbers are pinned in keymania-api's lib/tests/scoring.test.ts.
 * The two repos each hold a copy of the rules, and nothing but these two tests
 * stops them drifting apart again — which they already did once, silently, in a
 * way that only showed up as an impossible number on a results screen.
 */
describe('constants shared with keymania-api', () => {
  it('matches the server, value for value', () => {
    expect({
      MAX_HEALTH, BASE_DAMAGE, COMBO_WINDOW_MS, SLOW_WPM, FAST_WPM,
      MIN_SPEED_MULTIPLIER, MAX_SPEED_MULTIPLIER, COMBO_STEP, MAX_COMBO_MULTIPLIER,
      MIN_MS_PER_CHAR,
    }).toEqual({
      MAX_HEALTH: 100,
      BASE_DAMAGE: 1.2,
      COMBO_WINDOW_MS: 2600,
      SLOW_WPM: 25,
      FAST_WPM: 95,
      MIN_SPEED_MULTIPLIER: 0.85,
      MAX_SPEED_MULTIPLIER: 1.5,
      COMBO_STEP: 0.15,
      MAX_COMBO_MULTIPLIER: 2.0,
      MIN_MS_PER_CHAR: 28,
    });
  });

  it('gains nothing from claiming an impossible time, exactly as the server does', () => {
    expect(scoreWord({ characters: 4, elapsedMs: 1, combo: 0 }).damage)
      .toBe(scoreWord({ characters: 4, elapsedMs: 112, combo: 0 }).damage);
  });
});
