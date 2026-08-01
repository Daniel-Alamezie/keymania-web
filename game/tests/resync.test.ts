import { describe, expect, it } from 'vitest';
import { seekTo } from '../resync';

/**
 * Turning the server's flat word count back into a place in the script.
 *
 * A mistake here does not fail — it recreates the disaster it exists to end,
 * better dressed. The cursor lands one word out, and every submission after the
 * rejoin is judged against the wrong word and refused. So the assertions are
 * exact positions, not shapes.
 */

const SCRIPT = [
  'the quiet blade guards at dawn', // 6 words: flat 0-5
  'a golden river burns in silence', // 6 words: flat 6-11
  'ravens circle the old tower', // 5 words: flat 12-16
];

describe('seeking', () => {
  it('starts at the start for a player who has scored nothing', () => {
    expect(seekTo(SCRIPT, 0)).toEqual({
      scriptIndex: 0,
      sentence: 'the quiet blade guards at dawn ',
      upcoming: 'a golden river burns in silence ',
      cursor: 0,
    });
  });

  it('lands on the exact word owed, mid-sentence', () => {
    // Two words scored: 'the' and 'quiet'. The word owed is 'blade', which
    // starts after "the quiet " — ten characters.
    expect(seekTo(SCRIPT, 2)).toMatchObject({ scriptIndex: 0, cursor: 10 });
  });

  /**
   * The sentence boundary, which is where an off-by-one would live. Six words
   * scored is the whole first sentence — the position is the start of the
   * second, never the phantom seventh word of the first.
   */
  it('rolls to the next sentence exactly on its boundary', () => {
    expect(seekTo(SCRIPT, 6)).toEqual({
      scriptIndex: 1,
      sentence: 'a golden river burns in silence ',
      upcoming: 'ravens circle the old tower ',
      cursor: 0,
    });
  });

  /**
   * The script wraps for a player who outlasts it, and the server counts
   * straight past the end — the client wraps with modulo, and this must agree
   * with it or a long duel cannot be rejoined at all.
   */
  it('wraps like the duel does when the count passes the end', () => {
    const total = 17;
    expect(seekTo(SCRIPT, total)).toMatchObject({ scriptIndex: 3, cursor: 0 });
    expect(seekTo(SCRIPT, total).sentence).toBe('the quiet blade guards at dawn ');
    expect(seekTo(SCRIPT, total + 2)).toMatchObject({ cursor: 10 });
  });

  it('places the last word of the script correctly', () => {
    // Sixteen scored; 'tower' owed, after "ravens circle the old ".
    expect(seekTo(SCRIPT, 16)).toMatchObject({
      scriptIndex: 2,
      cursor: 'ravens circle the old '.length,
    });
  });

  /** Degenerate input answers with the top rather than a hang or a throw. */
  it('survives an empty script', () => {
    expect(seekTo([''], 5).cursor).toBe(0);
  });
});
