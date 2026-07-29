/**
 * The global standings — `GET /api/board`, proxying `GET /leaderboard`.
 *
 * This shape used to be declared inside LeaderboardPanel.tsx, which meant the
 * only way to find out what the endpoint returned was to read the component
 * that happened to render it.
 *
 * Every figure here comes from a duel the server refereed. Bot practice is
 * excluded entirely: a result the client reported about itself cannot be
 * ranked.
 */

/**
 * The two boards.
 *
 * `standings` leads, and that ordering is the whole point of having two. A
 * speed board is a `max()`: one clean run puts a player at the top and nothing
 * anybody does afterwards can dislodge them, so the rational move on reaching
 * first place is to stop playing. Rating only moves by duelling, so the board a
 * new arrival sees first is the one that rewards coming back.
 *
 * Speed is kept rather than dropped. It is the board that makes this a game
 * about typing rather than a game about winning, and it is also the only place
 * a player's own best is celebrated whether or not they beat anybody.
 */
export const BOARDS = ['standings', 'speed'] as const;
export type BoardKind = (typeof BOARDS)[number];

export const DEFAULT_BOARD: BoardKind = 'standings';

/**
 * Read a board name off untrusted input.
 *
 * Anything unrecognised becomes the default rather than an error, matching what
 * the upstream route already does and for the same reason: this value arrives
 * on a query string, on the first screen of the app, and a malformed one should
 * cost a player nothing more than seeing the usual board.
 */
export function asBoard(value: string | null | undefined): BoardKind {
  return BOARDS.includes(value as BoardKind) ? (value as BoardKind) : DEFAULT_BOARD;
}

/**
 * What each board is called, and what its number means.
 *
 * Kept beside the union rather than inlined in the component so that adding a
 * third board is a change in one file — and so the exhaustive `Record` makes
 * omitting its copy a compile error rather than an empty heading.
 */
export const BOARD_META: Record<BoardKind, {
  /** Short, because it sits in a two-tab strip. */
  tab: string;
  heading: string;
  /** What the big number in a row is, spelled out for assistive tech. */
  scoreLabel: string;
  footnote: string;
}> = {
  standings: {
    tab: 'Standings',
    heading: 'Standings',
    scoreLabel: 'rating',
    footnote: 'Rating moves every time you duel a person. Bots never count.',
  },
  speed: {
    tab: 'Fastest',
    heading: 'Fastest duels',
    scoreLabel: 'words per minute',
    footnote: 'Best sustained speed across one duel, timed by the server.',
  },
};

export interface BoardEntry {
  position: number;
  name: string;
  /**
   * Present only once a player has claimed one, which is what decides whether
   * their row is a link.
   *
   * Accounts that reached the board before handles existed have none until they
   * next open their own profile — nobody is assigned a public name they never
   * asked for just so a column can be filled.
   */
  handle?: string;
  /** Best sustained speed across a whole refereed duel. */
  wpm: number;
  /**
   * Best accuracy across refereed duels. Colour on the board, never part of
   * the ordering — the server sees completed words, never keystrokes, so it
   * cannot verify this.
   */
  accuracy: number;
  /**
   * Where they stand. Sent on both boards, so a row reads the same whichever
   * one is showing; optional because it is absent for anybody who reached the
   * board before ratings existed, and those rows fall back to START_RATING
   * exactly as the server's own `ratingOf` does.
   */
  rating?: number;
}

export interface LeaderboardResponse {
  /** Which board answered. Echoed by the API, so a fallback is visible. */
  board: BoardKind;
  entries: BoardEntry[];
}
