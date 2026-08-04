/**
 * The friend graph, as the browser sees it — `/api/me/friends`, proxying
 * `/friends` on keymania-api.
 *
 * Mirrors `src/lib/friends.ts` upstream. Nothing enforces that the two agree,
 * which is the standing hazard of this split: see models/README.md.
 */

import type { PublicCosmetics } from './cosmetics';
import type { CountryCode } from './countries';

/**
 * How you relate to someone, from your own side.
 *
 * Stored per side rather than as one shared row with a direction, so "what do I
 * need to act on?" is a filter rather than a comparison of who asked whom.
 * `blocked` never appears in a list — it is counted and nothing more.
 */
export type FriendState = 'outgoing' | 'incoming' | 'accepted' | 'blocked';

export interface Friend {
  /** The unique name, and the only way to address them. */
  handle: string;
  /** What to show. Free text, not unique — never use it to identify anybody. */
  displayName: string;
  state: FriendState;
  /** When the relationship last changed. */
  since: number;
  /**
   * Whether they are around, and interruptible.
   *
   * Absent from a server that predates it, which reads as unknown rather
   * than as offline — a dot asserting somebody is away when we simply have
   * not been told is worse than no dot.
   */
  presence?: Presence;
  /**
   * Roughly how long ago they were here, if they are not here now.
   *
   * A bucket, never a timestamp. The server derives it and the raw `seenAt`
   * never crosses the wire: a dot says "not right now", which is a fact about
   * a game, whereas an exact last-seen is a fact about a person's evening and
   * a list of them is something you can watch somebody with.
   *
   * Absent both for a friend who is online and for one we have never heard
   * from, which the row must not conflate -- see SEEN_LABEL.
   */
  seen?: Seen;
  /** Their standing, so a row says who you would actually be playing. */
  rating?: number;
  bestWpm?: number;
  /** Furthest survival run, so the friends board can rank on streak too. */
  bestStreak?: number;
  /**
   * What they are wearing, resolved by the server exactly as a board row is.
   *
   * Here so the friends leaderboard renders identically to the global one. The
   * friends *panel* does not draw badges and never has; this exists for the
   * board, which shares its row component with the global board and reads this
   * field or draws nothing.
   */
  cosmetics?: PublicCosmetics;
  /** The country they chose to show, so a friends row matches a global one. */
  country?: CountryCode;
  /**
   * This week's sprint, and absent for two different reasons the friends board
   * has to keep apart: the caller did not ask for it (no `include=weekly`), or
   * they asked and this friend has not run the challenge. The first means "we
   * do not know", the second means "they have no score" — showing a dash for
   * both is fine, but ranking somebody last because we never asked is not.
   */
  weekly?: { words: number; wpm: number; score: number };
}

/**
 * Around, mid-game, or gone.
 *
 * Three rather than two, because "online" alone cannot answer the question a
 * friends list is really being asked — not "are they there" but "can I ask
 * them for a game right now".
 */
export type Presence = 'idle' | 'busy' | 'offline';

/** How long ago, coarsely. Mirrors `Seen` in the API's lib/presence.ts. */
export type Seen = 'hour' | 'day' | 'week' | 'ago';

/**
 * What a bucket says out loud.
 *
 * Elapsed time, phrased as elapsed time. "Seen today" is friendlier and is a
 * lie at one in the morning, and these are friends in every timezone, so
 * there is no calendar any of this could be honest about.
 */
export const SEEN_LABEL: Record<Seen, string> = {
  hour: 'Seen within the hour',
  day: 'Seen in the last day',
  week: 'Seen this week',
  ago: 'Seen a while ago',
};

/**
 * Whoever can actually play, first.
 *
 * A friends list ordered by when a friendship started answers a question
 * nobody asks. Ordered by presence it answers the real one — who is around
 * right now — which also means the people worth acting on never sink below a
 * scroll as somebody's list grows.
 *
 * Ties keep their existing order, so a friend cannot jump around the list on
 * every poll merely because two rows scored the same. `Array.prototype.sort`
 * has been required to be stable since ES2019, so this is a guarantee and not
 * a hope about the engine.
 *
 * An unknown presence sorts with the offline group. It is the reading that
 * fails quietly: a row from an older server lands at the bottom instead of
 * displacing somebody we know is there.
 */
const ORDER: Record<Presence, number> = { idle: 0, busy: 1, offline: 2 };

export function byPresence(friends: readonly Friend[]): Friend[] {
  const rank = (friend: Friend) => ORDER[friend.presence ?? 'offline'] ?? ORDER.offline;
  return [...friends].sort((a, b) => rank(a) - rank(b));
}

/** `GET /api/me/friends`. */
export interface FriendsResponse {
  friends: Friend[];
  /** Requests waiting on you. */
  incoming: Friend[];
  /** Requests you have sent that nobody has answered yet. */
  outgoing: Friend[];
  /**
   * How many people you have blocked — a count, never a list.
   *
   * Enough to show that blocks exist without rendering a roll of people the
   * player has deliberately put out of mind.
   */
  blocked: number;
}

/** `POST /api/me/friends`. */
export interface AddFriendRequest {
  handle: string;
}

/**
 * `PUT /api/me/friends/{handle}`.
 *
 * Omitting the action accepts a pending request, which is the common case.
 */
export interface FriendActionRequest {
  action?: 'block' | 'unblock';
}

export interface FriendActionResponse {
  status: string;
}
