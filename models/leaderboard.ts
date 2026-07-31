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
 * The three boards.
 *
 * `standings` leads, and that ordering is the whole point of having more than
 * one. A speed board is a `max()`: one clean run puts a player at the top and
 * nothing anybody does afterwards can dislodge them, so the rational move on
 * reaching first place is to stop playing. Rating only moves by duelling, so the
 * board a new arrival sees first is the one that rewards coming back.
 *
 * Speed is kept rather than dropped. It is the board that makes this a game
 * about typing rather than a game about winning, and it is also the only place a
 * player's own best is celebrated whether or not they beat anybody.
 *
 * `streak` is the third, and it is last for the same reason speed is not first:
 * it is another `max()`, and it belongs to one mode rather than to the game. It
 * measures something neither of the others can — how far a single run got before
 * one wrong letter ended it — which is a distance rather than a rate or a
 * standing.
 */
export const BOARDS = ['standings', 'speed', 'streak'] as const;
export type BoardKind = (typeof BOARDS)[number];

export const DEFAULT_BOARD: BoardKind = 'standings';

/**
 * How many rows the menu panel shows before deferring to the full board.
 *
 * Five, because the menu is somewhere you glance on the way to a duel. Ten rows
 * of other people's numbers between a player and the button they came for is a
 * wall, and the two names most worth seeing are the one at the top and your own.
 * The rest is a page away rather than gone.
 */
export const PANEL_ROWS = 5;

/**
 * How many rows each surface asks the API for.
 *
 * The panel fetches ten and shows five, so the "see the full board" link knows
 * whether there is anything past the cap without a second request.
 *
 * The page asks for a page at a time. Fifty rather than everything, because
 * every row costs the server an extra read — the handle is not in the index
 * projection and cannot be added to it — so a board of a thousand fetched whole
 * is a thousand reads to render a screen nobody scrolls to the bottom of.
 */
export const PANEL_LIMIT = 10;
export const PAGE_LIMIT = 50;

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
  /**
   * What an empty board says, and how to stop it being empty.
   *
   * Here rather than in the components, which each carried their own copy of
   * "Beat another player and the board is yours" — true of the standings, and
   * wrong on a board where there is nobody to beat. Two copies of one sentence
   * is also two places to fix when it turns out to be wrong on a third board,
   * which is exactly what happened.
   */
  empty: string;
}> = {
  standings: {
    tab: 'Standings',
    heading: 'Standings',
    scoreLabel: 'rating',
    footnote: 'Rating moves every time you duel a person. Bots never count.',
    empty: 'Nobody has been ranked yet. Beat another player and the board is yours.',
  },
  speed: {
    tab: 'Fastest',
    heading: 'Fastest duels',
    scoreLabel: 'words per minute',
    footnote: 'Best sustained speed across one duel, timed by the server.',
    empty: 'No duels timed yet. Finish one and the top spot is yours.',
  },
  streak: {
    tab: 'Survival',
    heading: 'Longest runs',
    scoreLabel: 'words survived',
    /**
     * The speed is named here on purpose.
     *
     * A distance on its own invites the question of how it was earned, and the
     * answer is the interesting part: the forge cools faster the further a run
     * goes, so getting a long way is only possible at a pace the server timed.
     * Saying so turns the second figure on the row from a decoration into the
     * reason the first one is worth anything.
     */
    footnote: 'Words survived in one run, and the speed it took to get there.',
    empty: 'No runs have survived anything yet. Start one and see how far you get.',
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
  /**
   * Words survived in the longest run, and the ordering of the survival board.
   *
   * Sent only by that board. Absent rather than zero elsewhere, because the
   * other two do not read the index that carries it and a zero would be
   * indistinguishable from somebody who has run and got nowhere.
   */
  streak?: number;
}

export interface LeaderboardResponse {
  /** Which board answered. Echoed by the API, so a fallback is visible. */
  board: BoardKind;
  entries: BoardEntry[];
}
