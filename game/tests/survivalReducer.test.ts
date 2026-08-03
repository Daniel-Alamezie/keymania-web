import { describe, expect, it } from 'vitest';
import {
  currentWord, initialSurvival, survivalReducer, survivalWpm,
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

  /**
   * The bug that killed the first playtest, from the client's side of it.
   *
   * The server sent its judgement nested inside `withRoom`'s `{ room, result }`
   * wrapper, so `heat`, `cooling` and `wordIndex` were all `undefined` at the top
   * level of the message. The type said `number`, this reducer believed it, and
   * the undefined went into state, out to the bar, and into `element.animate()`,
   * which threw on a duration of `NaN` and took the run screen with it.
   *
   * The seam is fixed on the server. This is the client refusing to be the reason
   * next time: a message it cannot use leaves the forge where it was, and the run
   * carries on against a slightly stale number, which is what happens between
   * words anyway.
   */
  it('keeps the forge it had rather than taking a number it cannot use', () => {
    const good = survivalReducer(running(), {
      type: 'confirm', heat: 4_000, cooling: 1.2, words: 5,
    });
    const broken = survivalReducer(good, {
      type: 'confirm',
      heat: undefined as unknown as number,
      cooling: undefined as unknown as number,
      words: undefined as unknown as number,
    });
    expect(broken.heat).toBe(4_000);
    expect(broken.cooling).toBe(1.2);
    expect(broken.words).toBe(5);
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

  /**
   * The word clock starts with the word, including the very first one.
   *
   * A duel stamps this when its countdown ends; survival's `countdown` action
   * carries no `now`, so it cannot. Left at zero, the first word's elapsed time
   * was measured from the Unix epoch, the server clamped that to its ceiling,
   * and the opening word of every run scored as the slowest ever typed.
   */
  it('starts the word clock on the first key of the first word', () => {
    expect(running().wordStartedAt).toBe(0);
    expect(type(running(), 'o', 4_000).wordStartedAt).toBe(4_000);
  });

  it('restarts the word clock on each word after that', () => {
    const state = type(running(), 'one ', 4_000);
    expect(state.wordStartedAt).toBe(4_000);
    expect(survivalReducer(state, { type: 'typed', char: 't', now: 9_000 }).wordStartedAt)
      .toBe(4_000);
  });

  /** Stamped at the end, so the figure on the result screen stops moving. */
  it('records when the run finished, both ways it can', () => {
    expect(type(running(), 'x', 7_000).finishedAt).toBe(7_000);
    expect(survivalReducer(running(), { type: 'end', reason: 'cold', now: 9_000 }).finishedAt)
      .toBe(9_000);
  });
});

/**
 * The word a run died in the middle of.
 *
 * A wrong key ends the run without ever committing a word, so this is the only
 * thing there is to name when telling the server it is over. Getting it wrong is
 * not cosmetic: the referee matches it against the word it owed, and a mismatch
 * used to leave the room open, which is what made every second run of a session
 * impossible to start.
 */
describe('currentWord', () => {
  const at = (cursor: number) => currentWord({ ...running(), cursor });

  it('names the whole word, not the part already typed', () => {
    expect(at(0)).toBe('one');
    expect(at(1)).toBe('one');
    expect(at(2)).toBe('one');
  });

  it('names the word the space is about to commit, not the next one', () => {
    expect(at(3)).toBe('one');
  });

  it('moves on once the cursor is past the space', () => {
    expect(at(4)).toBe('two');
    expect(at(5)).toBe('two');
  });

  /** Sentences carry a trailing space, so the last word has a right edge too. */
  it('does not run off the end on the final word', () => {
    expect(at(7)).toBe('two');
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

/**
 * The bug a player reported after 68 words.
 *
 * Their words: "I reach around 68 words in a row then the words disappear and
 * all I can do is spam space bar to keep the session live otherwise the forge
 * cools." That is a precise description of `sentence` being a single space.
 *
 * The client walks the script forward and the server wraps around it with a
 * modulo, so the two only agree while the script is long enough. The server
 * tops it up as a run goes on, but only enough to break even: one sentence
 * added per sentence consumed, with no buffer. Any message in flight at the
 * wrong moment and the client rolls onto a sentence that does not exist yet.
 *
 * `withSpace(undefined ?? '')` is `' '`. A sentence one character long, and that
 * character a space, is a line with no words in it where the only key that
 * advances anything is the spacebar. Every press commits an empty word and
 * consumes another script slot, so spamming space to stay alive is also what
 * stops it ever recovering.
 */
describe('running off the end of the script', () => {
  const short = ['one two', 'three four'];

  const toTheEnd = () => {
    let state = survivalReducer(initialSurvival(), { type: 'begin', script: short });
    for (let i = 0; i < 3; i += 1) state = survivalReducer(state, { type: 'countdown' });
    return type(state, 'one two three four ');
  };

  /**
   * The guarantee is not that the line is never blank. The stream genuinely has
   * nothing to show for the moment it takes the next sentence to arrive, and
   * pretending otherwise would mean inventing words the referee never agreed to.
   *
   * The guarantee is that a blank line costs the player nothing. Most of all it
   * cannot kill them: dying to a wrong letter is the whole mode, and dying to a
   * wrong letter typed at a line with no letters on it is not.
   */
  it('cannot end the run while there is nothing to type', () => {
    const waiting = type(toTheEnd(), 'xyz ');
    expect(waiting.phase).toBe('running');
    expect(waiting.ended).toBeNull();
  });

  it('counts nothing while it waits, so the score cannot drift', () => {
    const stranded = toTheEnd();
    expect(type(stranded, '   ').words).toBe(stranded.words);
  });

  it('takes up a sentence that arrives after the stream ran dry', () => {
    const stranded = survivalReducer(toTheEnd(), {
      type: 'confirm', heat: 6_000, cooling: 1, words: 4, appended: 'five six',
    });
    expect(stranded.sentence.trim()).toBe('five six');
  });

  /**
   * The half that made it unrecoverable. Each space committed a whole script
   * slot, so a player holding the game alive was consuming the stream faster
   * than any top-up could refill it.
   */
  it('does not burn through script slots while it is waiting', () => {
    const stranded = toTheEnd();
    const after = type(stranded, '   ');
    expect(after.scriptIndex).toBe(stranded.scriptIndex);
  });
});

/**
 * Healing a desynced run.
 *
 * Reported twice by the same player, at 68 and then 69 words: "no more words
 * left to type and I couldn't complete the run". The logs showed the truth —
 * not an empty script but a wall of refusals, because a survival mismatch
 * changes no state and ends nothing, so a run that fell out of step could
 * neither continue nor finish.
 *
 * The rule these pin: the referee's script AND position are both adopted.
 * Taking the index alone would leave a client that missed an appended
 * sentence reading different words at the same number — still refused, still
 * stuck, and now with a fix that looks like it should have worked.
 */
describe('resyncing a survival run', () => {
  const running = () => {
    let s = survivalReducer(initialSurvival(), {
      type: 'begin',
      script: ['alpha beta gamma', 'delta epsilon'],
    });
    while (s.phase === 'countdown') s = survivalReducer(s, { type: 'countdown' });
    return s;
  };

  const served = ['one two three', 'four five six', 'seven eight'];

  it('adopts the script the referee is actually holding', () => {
    const healed = survivalReducer(running(), { type: 'resync', script: served, wordIndex: 3 });
    expect(healed.script).toEqual(served);
    // Word 3 is 'four': the second sentence, at its start.
    expect(healed.sentence).toBe('four five six ');
    expect(healed.cursor).toBe(0);
  });

  it('takes the referee\'s count, since the local one is now known wrong', () => {
    const healed = survivalReducer(running(), { type: 'resync', script: served, wordIndex: 5 });
    expect(healed.words).toBe(5);
  });

  it('recomputes the word offset for the sentence it lands on', () => {
    const healed = survivalReducer(running(), { type: 'resync', script: served, wordIndex: 7 });
    // 'seven' is word 6; two sentences of three came before it.
    expect(healed.wordOffset).toBe(6);
  });

  /** A heal is a cursor correction. It must never read as damage. */
  it('leaves the forge exactly as it was', () => {
    const before = { ...running(), heat: 4210, cooling: 2 };
    const healed = survivalReducer(before, { type: 'resync', script: served, wordIndex: 2 });
    expect(healed.heat).toBe(4210);
    expect(healed.cooling).toBe(2);
    expect(healed.phase).toBe('running');
  });

  /** A message arriving after the run died must not raise it. */
  it('does nothing to a run that has already ended', () => {
    const dead = survivalReducer(running(), { type: 'end', reason: 'typo', now: 1_000 });
    const healed = survivalReducer(dead, { type: 'resync', script: served, wordIndex: 4 });
    expect(healed.phase).toBe('over');
    expect(healed.words).toBe(dead.words);
  });
});
