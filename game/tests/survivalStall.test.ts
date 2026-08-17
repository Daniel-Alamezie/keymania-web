import { describe, expect, it } from 'vitest';
import {
  initialSurvival, isStalled, isStarving, MAX_UNCONFIRMED, survivalReducer,
  type SurvivalState,
} from '../survivalReducer';

/**
 * How far the screen will get ahead of the referee.
 *
 * Three players reported a run dying around word 68, which is where the seed
 * used to end. The diagnosis was never really the seed: it was that nothing
 * stopped this client accepting words while the socket was dead, so a dropped
 * connection stayed invisible until the words ran out. By then the correction
 * spanned the whole run, and a correction that large does not read as a
 * correction — it reads as being thrown back to the beginning.
 *
 * A longer seed moves that wall. This is the thing that stops it being reached
 * with a dead socket at all.
 */

/**
 * Type the word the run is actually standing on, and the space that commits it.
 *
 * Driven off the state rather than from a literal, because survival is sudden
 * death: one wrong key ends the run, so a helper that types its own idea of
 * the word tests nothing but its own bookkeeping. Returns unchanged when the
 * reducer refuses to move, which is what a stall looks like from here.
 */
const typeWord = (state: SurvivalState, now = 1): SurvivalState => {
  let at = state;
  for (let guard = 0; guard < 64; guard += 1) {
    const char = at.sentence[at.cursor];
    if (char === undefined) return at;
    const next = survivalReducer(at, { type: 'typed', char, now });
    if (next === at) return at;
    at = next;
    if (char === ' ') return at;
  }
  return at;
};

/** A run standing on a script of known, simple words. */
const running = (): SurvivalState => {
  const script = Array.from({ length: 40 }, () => 'aa bb cc dd ee ff');
  let state = survivalReducer(initialSurvival(), { type: 'begin', script });
  while (state.phase === 'countdown') state = survivalReducer(state, { type: 'countdown' });
  return state;
};

const confirm = (state: SurvivalState, words: number): SurvivalState =>
  survivalReducer(state, { type: 'confirm', heat: 5_000, cooling: 1, words });

describe('a run whose referee is answering', () => {
  it('is never stalled', () => {
    let state = running();
    for (let i = 1; i <= 20; i += 1) {
      state = typeWord(state);
      state = confirm(state, state.words);
      expect(isStalled(state), `after ${i} words`).toBe(false);
    }
    expect(state.words).toBe(20);
  });

  /** The ordinary case: a word or two in flight, which is what latency is. */
  it('tolerates being a word or two ahead', () => {
    let state = running();
    state = typeWord(state);
    state = typeWord(state);
    expect(state.words - state.confirmed).toBe(2);
    expect(isStalled(state)).toBe(false);
  });
});

describe('a run whose referee has gone quiet', () => {
  /** Nothing is confirmed, so the gap is the count itself. */
  const silent = () => {
    let state = running();
    for (let i = 0; i < 40; i += 1) state = typeWord(state);
    return state;
  };

  it('stops at the ceiling instead of running to the end of the script', () => {
    const state = silent();
    expect(state.words).toBe(MAX_UNCONFIRMED);
    expect(isStalled(state)).toBe(true);
  });

  /**
   * The ceiling is a ceiling. Checked before the count moves, so the gap
   * reaches twelve and stops rather than overshooting to thirteen.
   */
  it('never exceeds the ceiling however long the silence lasts', () => {
    expect(silent().words - silent().confirmed).toBe(MAX_UNCONFIRMED);
  });

  /**
   * The old failure needed the client to reach the end of the words it held.
   * Stalling at twelve, with the server keeping forty ahead, means it cannot.
   */
  it('still has script left when it stops', () => {
    const state = silent();
    expect(isStarving(state)).toBe(false);
    expect(state.sentence.trim()).not.toBe('');
  });

  /** A stall is not a mistake. Nothing flinches and nothing is scored. */
  it('does not read the held keystroke as a typo', () => {
    const before = silent();
    const after = typeWord(before);
    expect(after.missTick).toBe(before.missTick);
    expect(after.phase).toBe('running');
    expect(after.words).toBe(before.words);
  });
});

describe('recovering', () => {
  const stalled = () => {
    let state = running();
    for (let i = 0; i < 40; i += 1) state = typeWord(state);
    return state;
  };

  it('resumes the moment the referee catches up', () => {
    let state = stalled();
    expect(isStalled(state)).toBe(true);

    state = confirm(state, MAX_UNCONFIRMED);
    expect(isStalled(state)).toBe(false);

    const before = state.words;
    state = typeWord(state);
    expect(state.words).toBe(before + 1);
  });

  /**
   * A resync is the referee's own position, so the gap is zero by definition.
   * Left stale it would come back already at the ceiling and stall on the very
   * next word, which is the same stuck run with a different explanation.
   */
  it('starts level again after a resync', () => {
    const state = survivalReducer(stalled(), {
      type: 'resync',
      script: ['aa bb cc', 'dd ee ff'],
      wordIndex: 4,
    });
    expect(state.words).toBe(4);
    expect(state.confirmed).toBe(4);
    expect(isStalled(state)).toBe(false);
  });
});
