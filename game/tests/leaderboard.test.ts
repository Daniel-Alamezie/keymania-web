import { describe, expect, it } from 'vitest';
import { asBoard, BOARDS, BOARD_META, DEFAULT_BOARD, PANEL_ROWS } from '../../models/leaderboard';

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
    expect(asBoard('streak')).toBe('streak');
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

describe('PANEL_ROWS', () => {
  /**
   * The cap has to be smaller than a full board or the "see the full board" link
   * offers a page showing exactly what the reader is already looking at. The
   * panel only renders that link when there is something past the cap, so a bad
   * value here does not break anything visibly: it just quietly removes the only
   * route to the page.
   */
  it('is smaller than a board, so the page has something to add', () => {
    expect(PANEL_ROWS).toBeGreaterThan(0);
    expect(PANEL_ROWS).toBeLessThan(10);
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
      expect(meta.empty.length).toBeGreaterThan(0);
    }
  });

  it('gives every board a distinct tab, so the strip is readable', () => {
    const tabs = BOARDS.map((kind) => BOARD_META[kind].tab);
    expect(new Set(tabs).size).toBe(BOARDS.length);
  });

  /**
   * Each empty board has to say how to stop being empty, in terms that apply to
   * it.
   *
   * The two components rendering this each carried their own copy of "Beat
   * another player and the board is yours", which is true of the standings and
   * nonsense on a board where there is nobody to beat. Moving the sentence here
   * fixed both at once, and this stops a later edit reintroducing one message
   * for boards that are won in different ways.
   */
  it('tells each empty board how to fill itself, in its own terms', () => {
    const messages = BOARDS.map((kind) => BOARD_META[kind].empty);
    expect(new Set(messages).size).toBe(BOARDS.length);
    expect(BOARD_META.streak.empty).not.toMatch(/beat another player/i);
  });
});
