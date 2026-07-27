import { describe, expect, it } from 'vitest';
import { accuracy, duelReducer, initialState, type DuelState } from '../duelReducer';

/** A duel already in progress on a known sentence. */
function playing(sentence = 'the cat sat '): DuelState {
  const now = 1_000_000;
  return {
    ...initialState('rival'),
    phase: 'playing',
    sentence,
    cursor: 0,
    wordStartedAt: now,
    lastWordAt: now,
    stats: {
      wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0,
      bestWpm: 0, startedAt: now, endedAt: 0,
    },
  };
}

const type = (state: DuelState, chars: string, now = 1_000_400): DuelState =>
  chars.split('').reduce((s, char) => duelReducer(s, { type: 'typed', char, now }), state);

describe('typing', () => {
  it('advances the cursor on each correct character', () => {
    const state = type(playing(), 'the');
    expect(state.cursor).toBe(3);
    expect(state.missTick).toBe(0);
  });

  it('counts a wrong character as a miss and does not advance', () => {
    const state = duelReducer(playing(), { type: 'typed', char: 'x', now: 1 });
    expect(state.cursor).toBe(0);
    expect(state.missTick).toBe(1);
    expect(state.stats.mistakes).toBe(1);
  });

  it('breaks the combo on a typo', () => {
    const built = { ...type(playing(), 'the '), playerCombo: 5 };
    const missed = duelReducer(built, { type: 'typed', char: 'z', now: 2 });
    expect(missed.playerCombo).toBe(0);
  });
});

describe('SPACE commits the word', () => {
  it('does not score the word until space is pressed', () => {
    const state = type(playing(), 'the');
    expect(state.lastHit).toBeNull();
    expect(state.playerCombo).toBe(0);
  });

  it('refuses to skip the space by typing the next word', () => {
    // After "the", the cursor sits on the space. Typing "c" (start of "cat")
    // must be rejected rather than silently skipping the commit key.
    const atSpace = type(playing(), 'the');
    const skipped = duelReducer(atSpace, { type: 'typed', char: 'c', now: 1 });
    expect(skipped.cursor).toBe(atSpace.cursor);
    expect(skipped.missTick).toBe(1);
    expect(skipped.lastHit).toBeNull();
  });

  it('scores the word, throws a blade and grows the combo on space', () => {
    const state = type(playing(), 'the ');
    expect(state.cursor).toBe(4);
    expect(state.playerCombo).toBe(1);
    expect(state.lastHit).not.toBeNull();
    expect(state.lastHit?.fromSlot).toBe(0);
    expect(state.lastHit!.damage).toBeGreaterThan(0);
    expect(state.stats.wordsTyped).toBe(1);
  });

  it('measures each word independently, not from the start of the sentence', () => {
    const first = type(playing(), 'the ');
    const second = type(first, 'cat ');
    expect(second.playerCombo).toBe(2);
    expect(second.stats.wordsTyped).toBe(2);
  });

  it('rolls a new sentence once the final word is committed', () => {
    const state = type(playing('hi there '), 'hi there ');
    expect(state.cursor).toBe(0);
    expect(state.sentence.endsWith(' ')).toBe(true);
    expect(state.stats.wordsTyped).toBe(2);
  });
});

describe('damage and victory', () => {
  it('applies damage only when a blade lands', () => {
    const thrown = type(playing(), 'the ');
    expect(thrown.fighters[1].health).toBe(100);
    const landed = duelReducer(thrown, { type: 'land', toSlot: 1, damage: 4, now: 1 });
    expect(landed.fighters[1].health).toBe(96);
  });

  it('decides the duel when a fighter is emptied', () => {
    const state = duelReducer(playing(), { type: 'land', toSlot: 1, damage: 999, now: 1 });
    // Not 'over': the arena holds while the loser falls. See Phase.
    expect(state.phase).toBe('finishing');
    expect(state.winner).toBe(0);
  });

  it('ignores further hits once the duel is decided', () => {
    const over = duelReducer(playing(), { type: 'land', toSlot: 0, damage: 999, now: 1 });
    const after = duelReducer(over, { type: 'land', toSlot: 1, damage: 50, now: 1 });
    expect(after.fighters[1].health).toBe(100);
    expect(after.winner).toBe(1);
  });
});

/**
 * The beat between the killing blow and the result screen.
 *
 * The risk here is the duel getting stuck in it, or the cinematic time leaking
 * into the player's speed — both of which would look like something else going
 * wrong rather than like a bug in a transition.
 */
describe('the finishing beat', () => {
  const decided = () =>
    duelReducer(playing(), { type: 'land', toSlot: 1, damage: 999, now: 5000 });

  it('settles into the result screen', () => {
    expect(duelReducer(decided(), { type: 'settle' }).phase).toBe('over');
  });

  it('only settles from the finishing beat', () => {
    // A stray settle mid-duel must not skip to the result screen.
    expect(duelReducer(playing(), { type: 'settle' }).phase).toBe('playing');
  });

  it('stops the clock on the blow, not when the banner appears', () => {
    // Otherwise every duel's speed would be diluted by the cinematic.
    const settled = duelReducer(decided(), { type: 'settle' });
    expect(settled.stats.endedAt).toBe(5000);
  });

  it('keeps the winner when a late resign arrives', () => {
    // The opponent's resign can land after the killing blow: the server sends
    // it, and the socket does not care that the duel is already decided.
    const after = duelReducer(decided(), { type: 'finish', winnerSlot: 1, now: 9000 });
    expect(after.winner).toBe(0);
    expect(after.stats.endedAt).toBe(5000);
  });

  it('does not let a late server update heal the fallen fighter', () => {
    const after = duelReducer(decided(), {
      type: 'setHealths', healths: [90, 90],
    });
    expect(after.fighters[1].health).toBe(0);
    expect(after.phase).toBe('finishing');
  });

  it('a resign goes through the same beat rather than cutting straight to the result', () => {
    const resigned = duelReducer(playing(), { type: 'finish', winnerSlot: 0, now: 5000 });
    expect(resigned.phase).toBe('finishing');
  });
});

describe('accuracy', () => {
  it('is 100% with no keystrokes and drops with mistakes', () => {
    expect(accuracy({ wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0, bestWpm: 0, startedAt: 0, endedAt: 0 })).toBe(100);
    expect(accuracy({ wordsTyped: 0, charsTyped: 9, mistakes: 1, maxCombo: 0, bestWpm: 0, startedAt: 0, endedAt: 0 })).toBe(90);
  });
});
