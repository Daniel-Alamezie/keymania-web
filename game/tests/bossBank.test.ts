import { describe, expect, it } from 'vitest';
import {
  bossLine, bossScript, bossWords, spellableFrom, unspellable, WORDS_PER_LINE,
  type BossBank, type Pick,
} from '../bossBank';

/** Module one: the home row, and words that can be spelled from it. */
const HOME_ROW: BossBank = {
  alphabet: 'asdfjkl',
  words: ['ask', 'flask', 'salad', 'fall', 'lads', 'all', 'sad', 'jak'],
};

/** Cycles the bank so a line's contents are known exactly. */
const cycling = (): Pick => {
  let n = 0;
  return (upTo: number) => { const at = n % upTo; n += 1; return at; };
};

describe('spelling against the taught alphabet', () => {
  it('accepts a word made only of taught keys', () => {
    expect(spellableFrom('flask', 'asdfjkl')).toBe(true);
  });

  it('rejects a word needing one key that has not been taught', () => {
    expect(spellableFrom('flake', 'asdfjkl')).toBe(false);
  });

  it('rejects an empty word rather than calling it spellable', () => {
    expect(spellableFrom('', 'asdfjkl')).toBe(false);
  });
});

describe('the bank', () => {
  /**
   * The invariant the whole boss idea rests on. A single untaught letter turns
   * the victory lap into the exact experience the path exists to prevent.
   */
  it('drops any word its alphabet cannot spell', () => {
    const leaky: BossBank = { alphabet: 'asdfjkl', words: ['flask', 'flake', 'quiet'] };
    expect(bossWords(leaky)).toEqual(['flask']);
  });

  it('names the offenders, so authoring mistakes can be asserted on', () => {
    const leaky: BossBank = { alphabet: 'asdfjkl', words: ['flask', 'flake', 'quiet'] };
    expect(unspellable(leaky)).toEqual(['flake', 'quiet']);
    expect(unspellable(HOME_ROW)).toEqual([]);
  });

  it('deduplicates, so a repeated word is not simply said twice as often', () => {
    const doubled: BossBank = { alphabet: 'asdfjkl', words: ['ask', 'ask', 'fall'] };
    expect(bossWords(doubled)).toEqual(['ask', 'fall']);
  });
});

describe('a boss line', () => {
  it('is the requested number of words', () => {
    expect(bossLine(bossWords(HOME_ROW), 6, cycling()).split(' ')).toHaveLength(6);
  });

  it('uses only keys the module has taught', () => {
    const line = bossLine(bossWords(HOME_ROW), 20, cycling());
    for (const char of line.replace(/ /g, '')) {
      expect(HOME_ROW.alphabet).toContain(char);
    }
  });

  it('does not say the same word twice running when it has a choice', () => {
    const line = bossLine(['ask', 'fall', 'salad'], 8, () => 0);
    const words = line.split(' ');
    for (let i = 1; i < words.length; i += 1) expect(words[i]).not.toBe(words[i - 1]);
  });

  /** A four-word bank cannot always avoid a repeat, and must not hang trying. */
  it('terminates on a bank of one, repeats and all', () => {
    expect(bossLine(['ask'], 3, () => 0)).toBe('ask ask ask');
  });
});

describe('a boss script', () => {
  it('is the requested number of lines, each of the standard length', () => {
    const script = bossScript(HOME_ROW, 5, cycling());
    expect(script).toHaveLength(5);
    for (const line of script) expect(line.split(' ')).toHaveLength(WORDS_PER_LINE);
  });

  it('never contains a key the module has not taught', () => {
    const script = bossScript(HOME_ROW, 12, cycling());
    for (const char of script.join('').replace(/ /g, '')) {
      expect(HOME_ROW.alphabet).toContain(char);
    }
  });

  it('carries no leading or trailing space for the duel to trip on', () => {
    for (const line of bossScript(HOME_ROW, 4, cycling())) expect(line).toBe(line.trim());
  });

  /**
   * Loud rather than empty. An empty script is a duel with nothing to type and
   * no way out, which is far harder to diagnose than a thrown message.
   */
  it('throws on a bank whose own alphabet spells none of its words', () => {
    expect(() => bossScript({ alphabet: 'asdf', words: ['quiet'] }, 3))
      .toThrow(/no word its own alphabet can spell/);
  });
});
