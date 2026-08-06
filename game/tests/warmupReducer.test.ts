import { describe, expect, it } from 'vitest';
import {
  initialWarmup, warmupAccuracy, warmupReducer,
  type WarmupState,
} from '../warmupReducer';

/**
 * The warm-up's rules, pinned.
 *
 * Two of them are the mode itself rather than details of it: the words never
 * run out, and a typo costs the streak and nothing else. If either breaks, what
 * is left is Survival with the danger removed, which is not a mode anybody
 * asked for.
 */

const begin = (lines: string[]) =>
  warmupReducer(initialWarmup(), { type: 'begin', lines });

/** Type a string through the reducer, character by character. */
const type = (state: WarmupState, text: string) =>
  [...text].reduce((at, char) => warmupReducer(at, { type: 'typed', char }), state);

describe('starting', () => {
  it('opens on the first line with the second in view', () => {
    const state = begin(['as sad', 'a lad', 'salad days']);
    expect(state.sentence).toBe('as sad ');
    expect(state.upcoming).toBe('a lad ');
    expect(state.queue).toEqual(['salad days']);
  });

  it('drops blank lines rather than presenting one', () => {
    expect(begin(['  ', 'real words']).sentence).toBe('real words ');
  });

  it('survives being handed nothing', () => {
    // Should not be reachable, but a screen that cannot be typed on is a worse
    // failure than an empty one.
    expect(begin([]).sentence).toBe('');
  });
});

describe('the streak', () => {
  it('adds one for every clean word', () => {
    const state = type(begin(['as sad lad', 'more words']), 'as sad ');
    expect(state.streak).toBe(2);
    expect(state.words).toBe(2);
  });

  it('falls to zero the moment a key is missed', () => {
    let state = type(begin(['as sad lad', 'more words']), 'as ');
    expect(state.streak).toBe(1);

    state = warmupReducer(state, { type: 'typed', char: 'x' });
    expect(state.streak).toBe(0);
  });

  /**
   * The rule that needs `wordClean`.
   *
   * The miss already zeroed the streak, and committing a word only ever
   * increments — so without the flag, a word with a typo in the middle would
   * still climb to one, and the counter would rise through mistakes. That is
   * the single thing it must not do.
   */
  it('does not count the word the typo happened in', () => {
    let state = begin(['as sad lad', 'more words']);
    state = type(state, 'a');
    state = warmupReducer(state, { type: 'typed', char: 'x' });
    state = type(state, 's ');

    expect(state.words).toBe(1);
    expect(state.streak).toBe(0);
  });

  it('starts climbing again from the next word', () => {
    let state = begin(['as sad lad', 'more words']);
    state = type(state, 'a');
    state = warmupReducer(state, { type: 'typed', char: 'x' });
    state = type(state, 's sad ');

    expect(state.streak).toBe(1);
  });

  it('remembers the longest reached, not the one it ended on', () => {
    let state = type(begin(['as sad lad', 'more words']), 'as sad ');
    expect(state.best).toBe(2);

    state = warmupReducer(state, { type: 'typed', char: 'x' });
    expect(state.streak).toBe(0);
    expect(state.best).toBe(2);
  });
});

describe('a wrong key', () => {
  it('never moves the cursor', () => {
    const state = warmupReducer(begin(['as sad', 'more']), { type: 'typed', char: 'z' });
    expect(state.cursor).toBe(0);
    expect(state.misses).toBe(1);
  });

  it('flinches the line, so the screen has something to react to', () => {
    const state = warmupReducer(begin(['as sad', 'more']), { type: 'typed', char: 'z' });
    expect(state.missTick).toBe(1);
  });

  it('ends nothing — there is no phase to end', () => {
    let state = begin(['as sad', 'more']);
    for (let at = 0; at < 20; at += 1) {
      state = warmupReducer(state, { type: 'typed', char: 'z' });
    }
    // Still typeable, still on the same key, twenty mistakes later.
    expect(type(state, 'as ').words).toBe(1);
  });
});

describe('never running out', () => {
  it('wraps onto the next line and pulls the queue forward', () => {
    let state = begin(['as sad', 'a lad', 'salad days']);
    state = type(state, 'as sad ');

    expect(state.sentence).toBe('a lad ');
    expect(state.upcoming).toBe('salad days ');
    expect(state.queue).toEqual([]);
    expect(state.previous).toBe('as sad ');
  });

  it('keeps the word offset running across lines', () => {
    const state = type(begin(['as sad', 'a lad', 'salad days']), 'as sad ');
    expect(state.wordOffset).toBe(2);
  });

  it('takes fed lines and puts them behind the one in view', () => {
    let state = begin(['as sad', 'a lad']);
    state = warmupReducer(state, { type: 'feed', line: 'fresh words' });
    expect(state.queue).toEqual(['fresh words']);
  });

  /**
   * The floor under the buffer.
   *
   * The screen feeds on every commit, so this should be unreachable. But an
   * endless mode that can arrive at an empty sentence is one that can stop
   * dead, and a repeated line is a far cheaper failure than a screen nobody can
   * type on.
   */
  it('repeats rather than emptying when the buffer runs dry', () => {
    let state = begin(['as sad']);
    expect(state.upcoming).toBe('');

    state = type(state, 'as sad ');
    expect(state.sentence).toBe('as sad ');
    expect(state.cursor).toBe(0);
  });

  it('goes on far past the lines it was given', () => {
    let state = begin(['as sad']);
    for (let round = 0; round < 30; round += 1) state = type(state, 'as sad ');
    expect(state.words).toBe(60);
    expect(state.streak).toBe(60);
  });
});

describe('accuracy', () => {
  it('opens at 1, because nobody has missed anything yet', () => {
    expect(warmupAccuracy(begin(['as sad', 'more']))).toBe(1);
  });

  it('is the share of keys struck correctly', () => {
    let state = begin(['as sad', 'more']);
    state = type(state, 'a');
    state = warmupReducer(state, { type: 'typed', char: 'z' });
    state = type(state, 's');

    expect(warmupAccuracy(state)).toBeCloseTo(2 / 3);
  });
});
