import { describe, expect, it } from 'vitest';
import {
  asBoard, boardQuery, BOARDS, BOARD_META, DEFAULT_BOARD,
  MAX_LIMIT, PANEL_LIMIT, PANEL_ROWS,
} from '../../models/leaderboard';

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

/**
 * The query string, which is where the two halves disagreed.
 *
 * The client asked for fifty rows and the proxy forwarded only `board`, so every
 * request reached the API without a limit and came back with the default ten.
 * Neither file was wrong on its own. The agreement between them was simply never
 * written down, which is the same shape as every other seam bug in this project:
 * two correct halves and nothing holding them together.
 *
 * It is written down now and both call it, so these are the tests for the thing
 * that was missing rather than for either side of it.
 */
describe('boardQuery', () => {
  it('carries the row count, which is the whole reason it exists', () => {
    expect(boardQuery('standings', 50)).toBe('board=standings&limit=50');
  });

  /**
   * Clamped on this side as well as the server's. Both have to: the server
   * because the route is public and every row is an extra read, so a caller
   * choosing the count is a caller choosing the bill — and here so the number
   * interpolated into a URL is one of ours rather than one a query string
   * suggested.
   */
  it('will not ask for more rows than the server would ever return', () => {
    expect(boardQuery('speed', 5_000)).toBe(`board=speed&limit=${MAX_LIMIT}`);
  });

  it('falls back rather than sending nonsense upstream', () => {
    for (const junk of [0, -1, NaN, Infinity, undefined as unknown as number]) {
      expect(boardQuery('streak', junk)).toBe(`board=streak&limit=${PANEL_LIMIT}`);
    }
  });

  it('rounds a fractional ask rather than passing it on', () => {
    expect(boardQuery('standings', 12.7)).toBe('board=standings&limit=12');
  });
});
