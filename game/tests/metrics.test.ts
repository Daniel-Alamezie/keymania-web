import { describe, expect, it } from 'vitest';
import { wpmFor } from '../engine';
import {
  accuracy, duelReducer, finalWpm, initialState, overallWpm, type DuelState,
} from '../duelReducer';

/**
 * Audits the speed and accuracy numbers against the standard definitions used
 * by typing tests, because a leaderboard is only as trustworthy as its metrics.
 *
 *   gross WPM = (characters typed / 5) / minutes      "a word is five characters"
 *   accuracy  = correct keystrokes / total keystrokes
 *
 * Crucially the standard counts the SPACE as one of the five characters.
 */

const START = 1_000_000;

function playing(sentence: string): DuelState {
  return {
    ...initialState('rival'),
    phase: 'playing',
    sentence,
    cursor: 0,
    wordStartedAt: START,
    lastWordAt: START,
    stats: {
      wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0,
      bestWpm: 0, startedAt: START, endedAt: 0,
    },
  };
}

/** Type a string, one character every `msPerChar`. */
function typeOut(state: DuelState, text: string, msPerChar: number): DuelState {
  let now = START;
  return text.split('').reduce((s, char) => {
    now += msPerChar;
    return duelReducer(s, { type: 'typed', char, now });
  }, state);
}

describe('wpmFor matches the standard formula', () => {
  it('treats five characters as one word', () => {
    // 5 characters in exactly one second => 1 word in 1/60 minute => 60 wpm
    expect(wpmFor(5, 1000)).toBeCloseTo(60, 5);
  });

  it('scales linearly with characters and inversely with time', () => {
    expect(wpmFor(10, 1000)).toBeCloseTo(120, 5);
    expect(wpmFor(5, 2000)).toBeCloseTo(30, 5);
  });
});

describe('overall speed over a whole duel', () => {
  it('counts every correct keystroke, spaces included', () => {
    // "the cat " is 8 characters including both spaces.
    const state = typeOut(playing('the cat '), 'the cat ', 100);
    expect(state.stats.charsTyped).toBe(8);

    // 8 characters in 800ms => (8/5) / (800/60000) = 120 wpm
    expect(overallWpm(state.stats, START + 800)).toBe(120);
  });

  it('does not credit incorrect keystrokes', () => {
    let state = playing('the cat ');
    state = duelReducer(state, { type: 'typed', char: 'x', now: START + 100 });
    expect(state.stats.charsTyped).toBe(0);
    expect(state.stats.mistakes).toBe(1);
  });
});

describe('accuracy', () => {
  it('is correct keystrokes over total keystrokes', () => {
    let state = playing('the cat ');
    // Three correct, then one wrong, then the correct one.
    state = typeOut(state, 'the', 100);
    state = duelReducer(state, { type: 'typed', char: 'z', now: START + 400 });
    state = duelReducer(state, { type: 'typed', char: ' ', now: START + 500 });

    // 4 correct out of 5 presses
    expect(state.stats.charsTyped).toBe(4);
    expect(state.stats.mistakes).toBe(1);
    expect(accuracy(state.stats)).toBe(80);
  });

  it('is 100% before anything is typed', () => {
    expect(accuracy(playing('the cat ').stats)).toBe(100);
  });
});

describe('the settled figure a leaderboard would rank', () => {
  it('freezes when the duel ends so results stop drifting', () => {
    let state = typeOut(playing('the cat '), 'the cat ', 100);
    state = duelReducer(state, { type: 'finish', winnerSlot: 0, now: START + 800 });

    const settled = finalWpm(state.stats);
    expect(settled).toBeGreaterThan(0);
    expect(state.stats.endedAt).toBeGreaterThan(0);

    // A live figure would keep falling as the results screen sat open, because
    // elapsed time grows while the character count does not.
    const laterLive = overallWpm(state.stats, state.stats.endedAt + 60_000);
    expect(laterLive).toBeLessThan(settled);
    expect(finalWpm(state.stats)).toBe(settled);
  });

  it('is zero before a duel has finished', () => {
    expect(finalWpm(playing('the cat ').stats)).toBe(0);
  });
});

describe('per-word speed', () => {
  it('measures the word including the space that commits it', () => {
    // Typing "the " is four keystrokes; committing on the space means the
    // elapsed time spans all four, so the character count must include it.
    // Otherwise the reported speed is understated by roughly 1/(n+1).
    const state = typeOut(playing('the cat '), 'the ', 100);
    // 4 characters in 400ms => (4/5) / (400/60000) = 120 wpm
    expect(state.stats.bestWpm).toBe(120);
  });

  it('reports a steady typist consistently across words', () => {
    // At a fixed rate, every word should report the same speed regardless of
    // its length. Uneven values mean the measure is length-biased.
    const state = typeOut(playing('a longer word here '), 'a longer word here ', 100);
    expect(state.stats.bestWpm).toBe(120);
  });
});
