import { describe, expect, it } from 'vitest';
import { CAPACITY_MS, coolingFor } from '../heat';
import { initialSurvival, isStarving, survivalReducer, type SurvivalState } from '../survivalReducer';

/**
 * Picking a run back up on a fresh socket.
 *
 * A survival run outlives its connection: API Gateway caps one at two hours and
 * a phone locking ends one sooner. Duels have been reclaimable since the two
 * hour cap was diagnosed in production; runs were not, and the omission was the
 * quiet half of the word 68 deaths. Nothing kept a run's room id, so the
 * reconnect never asked for it back, so the server went on holding a seat
 * pointed at a dead connection and dropped every word that arrived afterwards.
 *
 * This is the arithmetic the screen does on the way back in, which is the part
 * that can be got wrong silently: land on the wrong word and every keystroke is
 * a miss, and in sudden death a miss is the end of the run.
 */

/** What `Survival` builds on mount, with and without a run to reclaim. */
function mounted(script: string[], resume?: { wordIndex: number; heat: number }): SurvivalState {
  const begun = survivalReducer(initialSurvival(), { type: 'begin', script });
  if (!resume) return begun;
  let at = begun;
  while (at.phase === 'countdown') at = survivalReducer(at, { type: 'countdown' });
  at = survivalReducer(at, { type: 'resync', script, wordIndex: resume.wordIndex });
  return survivalReducer(at, {
    type: 'confirm',
    heat: resume.heat,
    cooling: coolingFor(resume.wordIndex),
    words: resume.wordIndex,
  });
}

const SCRIPT = ['alpha beta gamma', 'delta epsilon zeta'];

describe('a fresh run', () => {
  const fresh = mounted(SCRIPT);

  it('counts itself in', () => {
    expect(fresh.phase).toBe('countdown');
  });

  it('starts at the first word with a full forge', () => {
    expect(fresh.words).toBe(0);
    expect(fresh.heat).toBe(CAPACITY_MS);
    expect(fresh.sentence).toContain('alpha');
  });
});

describe('a run reclaimed mid-stream', () => {
  /* Four words in: the whole of the first sentence, then one of the second. */
  const back = mounted(SCRIPT, { wordIndex: 4, heat: 2_500 });

  /**
   * No second countdown. The forge does not pause for ceremony, so three
   * seconds of it would be three seconds of heat spent watching a number.
   */
  it('is running immediately', () => {
    expect(back.phase).toBe('running');
  });

  it('stands on the word the referee is owed, not the first', () => {
    expect(back.words).toBe(4);
    expect(back.sentence).toContain('delta');
    expect(back.cursor).toBeGreaterThan(0);
  });

  /**
   * The next character has to be the right one. If the seek lands even one
   * word out, the first key is a miss and a miss ends the run.
   */
  it('offers the character the player actually owes next', () => {
    expect(back.sentence[back.cursor]).toBe('e');
    const after = survivalReducer(back, { type: 'typed', char: 'e', now: 1_000 });
    expect(after.phase).toBe('running');
    expect(after.ended).toBeNull();
  });

  it('takes the forge the server says it holds, not a fresh one', () => {
    expect(back.heat).toBe(2_500);
    expect(back.heat).toBeLessThan(CAPACITY_MS);
  });

  /**
   * The cooling has to match how far in they are, or the bar empties at the
   * pace of a run that has only just started.
   */
  it('cools at the rate for where the run actually is', () => {
    expect(back.cooling).toBe(coolingFor(4));
    expect(back.cooling).toBeGreaterThan(1);
  });

  it('has words to type, so it does not come back starving', () => {
    expect(isStarving(back)).toBe(false);
  });
});

/**
 * The case that made all of this necessary: reclaiming with a script longer
 * than the one the client walked off the end of.
 */
describe('a run reclaimed after running dry', () => {
  it('comes back with the words it was missing', () => {
    const longer = [...SCRIPT, 'eta theta iota'];
    const back = mounted(longer, { wordIndex: 6, heat: 3_000 });
    expect(isStarving(back)).toBe(false);
    expect(back.sentence).toContain('eta');
    expect(back.words).toBe(6);
  });
});
