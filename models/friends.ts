/**
 * The friend graph, as the browser sees it — `/api/me/friends`, proxying
 * `/friends` on keymania-api.
 *
 * Mirrors `src/lib/friends.ts` upstream. Nothing enforces that the two agree,
 * which is the standing hazard of this split: see models/README.md.
 */

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
