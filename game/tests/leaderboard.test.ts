import { describe, expect, it } from 'vitest';
import { asBoard, BOARDS, BOARD_META, DEFAULT_BOARD } from '../../models/leaderboard';

/**
 * The board a player lands on, and what reaches the API.
 *
 * `asBoard` sits on two paths at once: the query string of a public page, and
 * the value interpolated into the upstream URL by `app/api/board/route.ts`. So
 * it has to settle on a real board for anything at all, and it must never widen
 * to something a caller supplied.
 */
describe('asBoard', () => {
  it('keeps a board it recognises', () => {
    expect(asBoard('standings')).toBe('standings');
    expect(asBoard('speed')).toBe('speed');
  });

  /**
   * Standings is the default, and it is the whole point of the change: the
   * speed board is a max(), so topping it makes never playing again the safest
   * move. Pinned here because "which board opens first" is a product decision
   * that a later refactor should not be able to quietly reverse.
   */
  it('defaults to standings, not speed', () => {
    expect(DEFAULT_BOARD).toBe('standings');
    expect(asBoard(undefined)).toBe('standings');
    expect(asBoard(null)).toBe('standings');
    expect(asBoard('')).toBe('standings');
  });

  it('falls back rather than passing an unknown value through', () => {
    expect(asBoard('fastest')).toBe('standings');
    expect(asBoard('STANDINGS')).toBe('standings');
    expect(asBoard('rating')).toBe('standings');
  });

  /**
   * The reason this matters beyond tidiness: the result is interpolated
   * straight into the upstream path. Anything that survived would append to
   * the API's own query string.
   */
  it('cannot be used to smuggle anything into the upstream path', () => {
    expect(asBoard('speed&limit=1000')).toBe('standings');
    expect(asBoard('../players')).toBe('standings');
    expect(asBoard('speed#')).toBe('standings');
  });
});

describe('BOARD_META', () => {
  /**
   * An exhaustive Record makes a missing entry a compile error, but not a
   * missing *string* — an empty heading still type-checks and renders as a
   * blank tab.
   */
  it('describes every board with something to show', () => {
    for (const kind of BOARDS) {
      const meta = BOARD_META[kind];
      expect(meta.tab.length).toBeGreaterThan(0);
      expect(meta.heading.length).toBeGreaterThan(0);
      expect(meta.scoreLabel.length).toBeGreaterThan(0);
      expect(meta.footnote.length).toBeGreaterThan(0);
    }
  });

  it('gives the two boards distinct tabs, so the strip is readable', () => {
    const tabs = BOARDS.map((kind) => BOARD_META[kind].tab);
    expect(new Set(tabs).size).toBe(BOARDS.length);
  });
});
