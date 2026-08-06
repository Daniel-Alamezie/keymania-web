import { describe, expect, it } from 'vitest';
import { keyFor } from '../typing';
import { bankFor } from '../curriculum';
import { bossWords } from '../bossBank';

/**
 * Whether a keystroke counts, when the script decides about case.
 *
 * Pinned because this rule existed twice and one copy was missing it, and the
 * failure was silent in the worst possible way: the capitals boss told players
 * they had mistyped a word they had typed correctly. Nothing threw, nothing
 * logged, and the only symptom was a fight that could not be won — which
 * walled the path at module 8, since the third star opens module 9.
 */

describe('a lower-case expectation', () => {
  it('accepts the letter typed plainly', () => {
    expect(keyFor('a', 'a')).toBe('a');
  });

  /**
   * Caps lock on during the home row is a mistake the screen has no business
   * punishing: case is not what that exercise is about.
   */
  it('accepts the same letter shifted', () => {
    expect(keyFor('a', 'A')).toBe('a');
  });
});

describe('an upper-case expectation', () => {
  it('is satisfied by the shifted letter', () => {
    expect(keyFor('A', 'A')).toBe('A');
  });

  /**
   * And NOT by the plain one. This is the half that must never be folded
   * away: accepting "a" for "A" would mark module 8 passed without the thing
   * it teaches — shift, held with the opposite hand — ever having happened.
   */
  it('is not satisfied by the plain letter', () => {
    expect(keyFor('A', 'a')).not.toBe('A');
  });
});

describe('the end of a script', () => {
  it('folds rather than throwing when nothing is expected', () => {
    expect(keyFor(undefined, 'A')).toBe('a');
  });
});

/**
 * The regression itself, stated as the thing a player does.
 *
 * Every capital in the capitals boss must be reachable by pressing that
 * capital. Driven off the real bank rather than a fixture, so a future edit to
 * the word list is covered by the same assertion.
 */
describe('the capitals boss is winnable', () => {
  const words = bossWords(bankFor('capitals')!);

  it('has capitals in it at all, or this proves nothing', () => {
    expect(words.some((word) => word !== word.toLowerCase())).toBe(true);
  });

  it('accepts every character of every word as typed', () => {
    for (const word of words) {
      for (const char of word) {
        expect(keyFor(char, char)).toBe(char);
      }
    }
  });

  it('refuses a capital typed without shift', () => {
    const capitals = words.flatMap((word) => [...word])
      .filter((char) => char !== char.toLowerCase());
    expect(capitals.length).toBeGreaterThan(0);
    for (const char of capitals) {
      expect(keyFor(char, char.toLowerCase())).not.toBe(char);
    }
  });
});
