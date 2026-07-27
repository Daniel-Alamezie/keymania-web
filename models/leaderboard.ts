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
}

export interface LeaderboardResponse {
  entries: BoardEntry[];
}
