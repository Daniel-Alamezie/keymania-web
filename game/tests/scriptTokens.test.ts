import { describe, expect, it } from 'vitest';
import { activeWordIn, lineOffsets, tokenise, wordCount } from '../scriptTokens';

/**
 * The arithmetic two renderers have to agree on.
 *
 * Every one of these guards the same thing from a different side: a word's
 * flat index is its identity, and powers, flares and bursts find their element
 * by it. Get it wrong and nothing throws — the wrong word lights up, which is
 * the kind of bug only a person looking at the screen ever finds.
 */

describe('tokenise', () => {
  const line = 'the printer set ';

  it('keeps the space with the word it follows', () => {
    const [first] = tokenise(line, 'current', 0);
    expect(first.chars.map((c) => c.ch).join('')).toBe('the ');
  });

  it('indexes characters by their position in the line, not the word', () => {
    const tokens = tokenise(line, 'current', 0);
    expect(tokens[1].chars[0]).toEqual({ ch: 'p', index: 4 });
  });

  /** The rule the claimed-power animation depends on. */
  it('keys every word by its flat script index', () => {
    expect(tokenise(line, 'current', 40).map((t) => t.key)).toEqual(['40', '41', '42']);
  });

  it('gives the same word the same key from any phase', () => {
    const asCurrent = tokenise(line, 'current', 12).map((t) => t.key);
    const asNext = tokenise(line, 'next', 12).map((t) => t.key);
    expect(asNext).toEqual(asCurrent);
  });

  /** Only the line being typed has positions worth knowing. */
  it('marks local positions on the current line alone', () => {
    expect(tokenise(line, 'current', 0).map((t) => t.localIndex)).toEqual([0, 1, 2]);
    expect(tokenise(line, 'past', 0).map((t) => t.localIndex)).toEqual([-1, -1, -1]);
  });

  it('keeps a trailing word that has no space after it', () => {
    expect(tokenise('one two', 'current', 0)).toHaveLength(2);
  });

  it('has nothing to say about an empty line', () => {
    expect(tokenise('', 'current', 0)).toEqual([]);
  });

  /** Punctuation rides with its word; it is not a word. */
  it('does not split on punctuation', () => {
    const tokens = tokenise('hand, one letter. ', 'current', 0);
    expect(tokens.map((t) => t.chars.map((c) => c.ch).join(''))).toEqual(
      ['hand, ', 'one ', 'letter. '],
    );
  });
});

describe('wordCount', () => {
  it('ignores the trailing space the reducer adds', () => {
    expect(wordCount('the printer set ')).toBe(3);
  });

  it('counts an empty line as nothing', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
  });
});

describe('lineOffsets', () => {
  const script = ['one two', 'three four five', 'six'];

  it('starts the first line at zero', () => {
    expect(lineOffsets(script)[0]).toBe(0);
  });

  it('gives each line the running total before it', () => {
    expect(lineOffsets(script)).toEqual([0, 2, 5]);
  });

  /**
   * The property that actually matters, stated directly: a paragraph laying
   * out every line must arrive at the same indices the tape does line by line.
   */
  it('agrees with tokenising the lines in order', () => {
    const offsets = lineOffsets(script);
    const keys = script.flatMap((line, i) => tokenise(line, 'current', offsets[i]).map((t) => t.key));
    expect(keys).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('handles an empty script', () => {
    expect(lineOffsets([])).toEqual([]);
  });
});

describe('activeWordIn', () => {
  const tokens = tokenise('the printer set ', 'current', 0);

  it('finds the word the cursor is inside', () => {
    expect(activeWordIn(tokens, 0)).toBe(0);
    expect(activeWordIn(tokens, 4)).toBe(1);
    expect(activeWordIn(tokens, 12)).toBe(2);
  });

  /** The space that commits a word still belongs to that word. */
  it('stays on the word whose trailing space is being typed', () => {
    expect(activeWordIn(tokens, 3)).toBe(0);
  });

  it('does not run off the end past the last character', () => {
    expect(activeWordIn(tokens, 99)).toBe(2);
  });

  it('survives a line with no tokens', () => {
    expect(activeWordIn([], 0)).toBe(0);
  });
});
