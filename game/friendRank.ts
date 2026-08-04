import type { Friend } from '@/models/friends';
import type { PublicCosmetics } from '@/models/cosmetics';

/**
 * Where you stand among your friends, on any of the four boards.
 *
 * **Computed here rather than asked of the server, and that is not an
 * optimisation.** A friends board is a different board for every viewer — it
 * has no global existence to be queried, because "my friends" is a different
 * set from "your friends" even when we are both on it. The server would have to
 * build one per caller from data the caller already has.
 *
 * Which it does: GET /friends already returns every friend's rating, best
 * speed and furthest streak. Ranking them is a sort of an array that is already
 * in memory, so switching the leaderboard to Friends costs one render and no
 * request at all.
 *
 * **The viewer's frame, always.** When this runs for somebody else's profile
 * card, the pool is still *your* friends — never theirs. Their rank among their
 * own friends would publish how many friends they have and who is in that
 * circle, which is the same class of fact the public profile withholds duel
 * history to avoid. See PublicProfile, where that distinction is the whole
 * reason the card takes a viewer.
 */

/** Which figure a board orders on. Mirrors the four boards the API serves. */
export type Board = 'standings' | 'speed' | 'streak' | 'weekly';

/**
 * Somebody who can be placed on a friends board: a friend, or you.
 *
 * You are deliberately the same shape as a friend rather than a special case
 * threaded through the sort. A "you" branch inside the comparison is how a
 * board ends up ranking its own viewer by a rule nobody else is ranked by.
 */
export interface Contender {
  handle: string;
  displayName: string;
  rating?: number;
  bestWpm?: number;
  bestStreak?: number;
  weekly?: { words: number; wpm: number; score: number };
  /**
   * What they are wearing, already resolved to a filename and a colour.
   *
   * Carried through the ranking rather than looked up by the row, because the
   * row this ends up in is the *same component* the global board renders — and
   * that component reads `entry.cosmetics` or draws nothing. A friends board
   * that silently loses everybody's badges is not a bug in the badge; it is a
   * field dropped in transit, which is exactly what happened the first time.
   */
  cosmetics?: PublicCosmetics;
  /** True for exactly one contender: the person looking at the board. */
  you?: boolean;
}

export interface RankedContender extends Contender {
  /**
   * Their place, or absent because they have no score on this board at all.
   *
   * Unranked is not last. Somebody who has never run the weekly sprint has not
   * lost it, and the global boards agree — a player with no rating is missing
   * from the standings index rather than sitting at the bottom of it.
   */
  position?: number;
  /** The figure this board ordered on, for the row to render. */
  score?: number;
}

/**
 * The figure each board ranks on, higher always better.
 *
 * `weekly.score` is the server's own composite range key — characters first,
 * elapsed time as the tiebreak — passed through rather than re-derived. Working
 * that rule out again here would be a second implementation of the scoring, and
 * the two would drift the first time either changed.
 */
const SCORE: Record<Board, (c: Contender) => number | undefined> = {
  standings: (c) => c.rating,
  speed: (c) => c.bestWpm,
  streak: (c) => c.bestStreak,
  weekly: (c) => c.weekly?.score,
};

/**
 * Zero is not a score.
 *
 * Every one of these figures defaults to 0 on a record that has never earned
 * one, so a bare `!== undefined` check would rank a player who has never
 * survived a single word as though they had run and scored nothing. On a
 * friends board of five that is four real entries and one phantom last place,
 * handed to whichever friend was newest.
 */
const scored = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Rank a set of contenders on one board.
 *
 * Ties share a position and the next place skips — the same competition ranking
 * the server's global rank produces, and for the same reason: a position that
 * depends on which of two equal players is listed first is not a position.
 *
 * Unranked contenders keep their place in the returned list, after everybody
 * with a score and ordered by name so the tail does not reshuffle on every
 * refresh. They carry no `position`.
 */
export function rankFriends(contenders: Contender[], board: Board): RankedContender[] {
  const score = SCORE[board];

  const withScores = contenders.map((c) => ({ ...c, score: score(c) }));
  const ranked = withScores.filter((c) => scored(c.score));
  const unranked = withScores
    .filter((c) => !scored(c.score))
    // Name order, and stable: an unranked tail sorted by nothing would be in
    // whatever order the friends endpoint happened to return, which changes.
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    // Explicitly scoreless rather than destructured-and-dropped: 0 is the
    // stored default for every one of these figures, and a row rendering "0"
    // would state a result the player never achieved.
    .map((c): RankedContender => ({ ...c, score: undefined }));

  ranked.sort((a, b) => (b.score as number) - (a.score as number));

  let position = 0;
  let previous: number | undefined;
  const placed = ranked.map((c, index) => {
    // Only advance the position when the score actually changes, so equals
    // share a place and the one after them skips the places the tie consumed.
    if (c.score !== previous) {
      position = index + 1;
      previous = c.score;
    }
    return { ...c, position } as RankedContender;
  });

  return [...placed, ...unranked];
}

/**
 * Your place among your friends, and how many of you are actually on the board.
 *
 * The total counts only contenders with a score, because that is what the
 * position is out of. "#3 of 12" when nine of those twelve have never played a
 * ranked duel is a worse number than "#3 of 4" — it implies you beat people who
 * were never in the running.
 */
export interface FriendStanding {
  position: number;
  of: number;
}

export function friendStanding(
  contenders: Contender[],
  board: Board,
): FriendStanding | undefined {
  const placed = rankFriends(contenders, board);
  const you = placed.find((c) => c.you);
  if (!you?.position) return undefined;

  return { position: you.position, of: placed.filter((c) => c.position !== undefined).length };
}

/**
 * Turn the friends list and the viewer into one pool.
 *
 * Kept beside the ranking rather than inlined at each call site, because
 * forgetting to include the viewer produces a board that looks completely
 * normal and is wrong by exactly one place for everybody below them.
 */
export function contenders(friends: Friend[], me: Contender | null): Contender[] {
  const pool: Contender[] = friends.map((f) => ({
    handle: f.handle,
    displayName: f.displayName,
    rating: f.rating,
    bestWpm: f.bestWpm,
    bestStreak: f.bestStreak,
    weekly: f.weekly,
    cosmetics: f.cosmetics,
  }));

  // Signed out, or a profile that has not loaded yet: the board is still a
  // perfectly good list of friends, it just cannot say where you are on it.
  if (me) pool.push({ ...me, you: true });
  return pool;
}
