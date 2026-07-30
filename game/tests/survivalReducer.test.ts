import { describe, expect, it } from 'vitest';
import {
  initialSurvival, survivalReducer, survivalWpm,
  type SurvivalState,
} from '../survivalReducer';
import { CAPACITY_MS } from '../heat';

const SCRIPT = ['one two', 'three four', 'five six'];

const started = (): SurvivalState =>
  survivalReducer(initialSurvival(), { type: 'begin', script: SCRIPT });

/** Runs the countdown out, since nothing is accepted before it finishes. */
const running = (): SurvivalState => {
  let state = started();
  for (let i = 0; i < 3; i += 1) state = survivalReducer(state, { type: 'countdown' });
  return state;
};

const type = (state: SurvivalState, text: string, now = 2_000): SurvivalState =>
  [...text].reduce((s, char) => survivalReducer(s, { type: 'typed', char, now }), state);

describe('starting a run', () => {
  it('takes the script the server committed to rather than inventing one', () => {
    const state = started();
    expect(state.sentence).toBe('one two ');
    expect(state.upcoming).toBe('three four ');
    expect(state.script).toEqual(SCRIPT);
  });

  it('refuses keystrokes until the countdown is done', () => {
    const early = survivalReducer(started(), { type: 'typed', char: 'o', now: 1_500 });
    expect(early.cursor).toBe(0);
    expect(early.phase).toBe('countdown');
  });
});

describe('typing', () => {
  it('advances through a word', () => {
    const state = type(running(), 'one');
    expect(state.cursor).toBe(3);
    expect(state.words).toBe(0);
    expect(state.phase).toBe('running');
  });

  it('counts a word when the space commits it', () => {
    const state = type(running(), 'one ');
    expect(state.words).toBe(1);
    expect(state.cursor).toBe(4);
  });

  /**
   * The whole mode, in one assertion. In a duel a typo costs a combo and you
   * carry on; here there is nothing to carry on to.
   */
  it('ends the run on the first wrong key', () => {
    const state = type(running(), 'onx');
    expect(state.phase).toBe('over');
    expect(state.ended).toBe('typo');
  });

  it('flinches the line on the way out, so the keystroke is visible', () => {
    const before = running();
    const after = type(before, 'x');
    expect(after.missTick).toBe(before.missTick + 1);
  });

  it('accepts nothing more once the run is over', () => {
    const dead = type(running(), 'x');
    const after = type(dead, 'one ');
    expect(after.words).toBe(0);
    expect(after.cursor).toBe(0);
  });

  it('rolls onto the next sentence when one finishes', () => {
    const state = type(running(), 'one two ');
    expect(state.previous).toBe('one two ');
    expect(state.sentence).toBe('three four ');
    expect(state.upcoming).toBe('five six ');
    expect(state.cursor).toBe(0);
    expect(state.words).toBe(2);
  });

  /**
   * The offset is what keeps the stream scrolling rather than jumping back to
   * the start of each sentence, and it has to advance by the words that sentence
   * actually held.
   */
  it('carries the word offset across a sentence boundary', () => {
    const state = type(running(), 'one two ');
    expect(state.wordOffset).toBe(2);
  });
});

describe('what the server says', () => {
  it('takes the referee word on heat, cooling and the count', () => {
    const state = survivalReducer(type(running(), 'one '), {
      type: 'confirm', heat: 4_200, cooling: 1.4, words: 9,
    });
    expect(state.heat).toBe(4_200);
    expect(state.cooling).toBe(1.4);
    // Corrected rather than trusted: the local count was optimistic.
    expect(state.words).toBe(9);
  });

  /**
   * The gap that would have ended every long run.
   *
   * The server tops the script up as a run goes on, because ten sentences is
   * about eighty words and a good run passes that. Without the appended sentence
   * arriving here, the client walks off the end of the words it was given and
   * starts disagreeing with the referee about what to type next.
   */
  it('takes on a sentence the server appended', () => {
    const state = survivalReducer(running(), {
      type: 'confirm', heat: CAPACITY_MS, cooling: 1, words: 1, appended: 'seven eight',
    });
    expect(state.script).toEqual([...SCRIPT, 'seven eight']);
  });

  it('ignores a late confirmation for a run already over', () => {
    const dead = type(running(), 'x');
    const after = survivalReducer(dead, {
      type: 'confirm', heat: CAPACITY_MS, cooling: 1, words: 40,
    });
    expect(after.phase).toBe('over');
    expect(after.words).toBe(0);
  });
});

describe('ending', () => {
  it('records a cold forge as its own cause', () => {
    const state = survivalReducer(running(), { type: 'end', reason: 'cold', now: 9_000 });
    expect(state.phase).toBe('over');
    expect(state.ended).toBe('cold');
    expect(state.heat).toBe(0);
  });

  /** Two different lessons: one says slow down, the other says the opposite. */
  it('does not overwrite the reason a run already ended', () => {
    const typo = type(running(), 'x');
    const after = survivalReducer(typo, { type: 'end', reason: 'cold', now: 9_000 });
    expect(after.ended).toBe('typo');
  });
});

describe('the clock', () => {
  /**
   * It starts on the first key, not when the run was armed.
   *
   * The countdown, the socket and the first render all happen before anybody
   * types. Counting them would report a speed nobody achieved, and the longer
   * the connection took the slower the player would look.
   */
  it('does not start until somebody types', () => {
    expect(running().startedAt).toBe(0);
    expect(type(running(), 'o', 4_000).startedAt).toBe(4_000);
  });

  it('does not restart on every subsequent key', () => {
    let state = type(running(), 'o', 4_000);
    state = survivalReducer(state, { type: 'typed', char: 'n', now: 9_999 });
    expect(state.startedAt).toBe(4_000);
  });

  /** Stamped at the end, so the figure on the result screen stops moving. */
  it('records when the run finished, both ways it can', () => {
    expect(type(running(), 'x', 7_000).finishedAt).toBe(7_000);
    expect(survivalReducer(running(), { type: 'end', reason: 'cold', now: 9_000 }).finishedAt)
      .toBe(9_000);
  });
});

describe('survivalWpm', () => {
  it('is zero before anything has been typed', () => {
    expect(survivalWpm(running(), 5_000)).toBe(0);
  });

  it('measures characters over elapsed time, on the five character word', () => {
    // 20 characters in 6 seconds is 4 words in 0.1 minutes, so 40wpm.
    const state = { ...running(), charsTyped: 20, startedAt: 0 };
    expect(survivalWpm(state, 6_000)).toBe(40);
  });

  it('does not divide by a clock that has not moved', () => {
    const state = { ...running(), charsTyped: 20, startedAt: 5_000 };
    expect(survivalWpm(state, 5_000)).toBe(0);
  });
});
