import { describe, expect, it } from 'vitest';
import { settledWpm } from '../duelReducer';

/**
 * One number, one authority.
 *
 * A player finished a duel at "83 wpm" on the result card and found "82" on
 * their profile. Neither figure was wrong; they were measured with different
 * rulers — the local count includes a half-typed final word and a clock that
 * runs until the client learns the duel ended, the server counts committed
 * words against a window ending at the last of them. The fix is not to make
 * the rulers agree, which they structurally cannot; it is to only ever show
 * the one that ranks people.
 */
describe('settledWpm', () => {
  it('quotes the record when there is one', () => {
    expect(settledWpm(82, 83)).toBe(82);
  });

  /** An older server sends no figure; the card estimates, as it always did. */
  it('falls back to the local estimate when the server said nothing', () => {
    expect(settledWpm(undefined, 83)).toBe(83);
  });

  /**
   * The case the obvious implementation gets wrong. Zero is a real recorded
   * speed — the duel ended before this player finished a word — and `??` would
   * discard it for the local estimate in exactly the situation where the two
   * disagree most. `typeof` keeps the honest zero.
   */
  it('honours a recorded zero instead of papering over it', () => {
    expect(settledWpm(0, 12)).toBe(0);
  });
});
