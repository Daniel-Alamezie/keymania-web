import { describe, expect, it } from 'vitest';
import { initialSurvival, isStarving, survivalReducer, type SurvivalState } from '../survivalReducer';

/**
 * Running off the end of the script, which killed three real runs at word 68.
 *
 * The number was the tell. A run is seeded with ten sentences and the bank
 * averages about six and a half words each, so the seed IS roughly sixty-eight
 * words: a player who reached the end of it had received none of the top-ups
 * the server sends as a run goes on. That happens whenever the socket drops or
 * reconnects mid-run, because the client advances optimistically and never
 * learns that the referee stopped answering.
 *
 * The reducer already refused to accept keys on an empty line, which stopped a
 * stranded run consuming script slots it did not have. What it did not do was
 * get the run out again: keys did nothing, nothing was sent, and the forge
 * carried on cooling to zero. Inert is not recovered, and from the player's
 * seat the two look identical.
 */

/** A run past its countdown, standing on the script it was given. */
function running(script: string[]): SurvivalState {
  let state = survivalReducer(initialSurvival(), { type: 'begin', script });
  while (state.phase === 'countdown') {
    state = survivalReducer(state, { type: 'countdown' });
  }
  return state;
}

const type = (state: SurvivalState, text: string): SurvivalState =>
  [...text].reduce(
    (at, char) => survivalReducer(at, { type: 'typed', char, now: 1_000 }),
    state,
  );

describe('a run with words still to type', () => {
  it('is not starving at the start', () => {
    expect(isStarving(running(['alpha beta']))).toBe(false);
  });

  it('is not starving mid-sentence', () => {
    expect(isStarving(type(running(['alpha beta']), 'alpha '))).toBe(false);
  });

  it('is not starving while the script still holds another sentence', () => {
    const state = type(running(['alpha beta', 'gamma delta']), 'alpha beta ');
    expect(isStarving(state)).toBe(false);
    expect(state.sentence).toContain('gamma');
  });
});

describe('a run that has typed the last word it was given', () => {
  const stranded = type(running(['alpha beta']), 'alpha beta ');

  it('knows it has nothing to type', () => {
    expect(isStarving(stranded)).toBe(true);
  });

  /** Not merely empty: there is no key that could be the right one. */
  it('has no character to offer the player', () => {
    expect(stranded.sentence.trim()).toBe('');
  });

  it('is still running, because starving is not dying', () => {
    expect(stranded.phase).toBe('running');
  });

  /**
   * The guard that was already there. Worth pinning: without it every letter
   * pressed on the blank line ended the run as a typo nobody typed.
   */
  it('ignores keystrokes rather than counting them as mistakes', () => {
    const after = type(stranded, 'xyz');
    expect(after.phase).toBe('running');
    expect(after.ended).toBeNull();
    expect(after.words).toBe(stranded.words);
  });

  it('does not let the space bar consume script it does not have', () => {
    const after = type(stranded, '     ');
    expect(after.words).toBe(stranded.words);
    expect(after.scriptIndex).toBe(stranded.scriptIndex);
  });
});

/**
 * The recovery. The client has handled this message since the last two reports
 * at 68 and 69 words; nothing ever sent it, which is why they kept coming back.
 */
describe('the referee answering a stranded run', () => {
  const stranded = type(running(['alpha beta']), 'alpha beta ');
  const healed = survivalReducer(stranded, {
    type: 'resync',
    script: ['alpha beta', 'gamma delta'],
    wordIndex: 2,
  });

  it('stops starving', () => {
    expect(isStarving(healed)).toBe(false);
  });

  it('puts a typable word back on screen', () => {
    expect(healed.sentence).toContain('gamma');
  });

  it('adopts the referee count over the optimistic one', () => {
    expect(healed.words).toBe(2);
  });

  it('takes keys again', () => {
    const after = type(healed, 'g');
    expect(after.cursor).toBe(1);
    expect(after.phase).toBe('running');
  });
});

/** The other half: a top-up landing on an ordinary confirmation. */
describe('a top-up arriving while stranded', () => {
  it('fills the empty line rather than only the one after it', () => {
    const stranded = type(running(['alpha beta']), 'alpha beta ');
    const fed = survivalReducer(stranded, {
      type: 'confirm',
      heat: 5_000,
      cooling: 1,
      words: 2,
      appended: 'gamma delta',
    });
    expect(isStarving(fed)).toBe(false);
    expect(fed.sentence).toContain('gamma');
  });
});
