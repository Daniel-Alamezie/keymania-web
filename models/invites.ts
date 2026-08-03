/**
 * Game invites, as the browser sees them.
 *
 * Mirrors `src/lib/invites.ts` upstream. Nothing enforces that the two agree,
 * which is the standing hazard of this split: see models/README.md.
 */

/** An invite waiting for this player, as delivered on the heartbeat. */
export interface PendingInvite {
  /** Who is asking. Also the key for accepting or declining. */
  fromHandle: string;
  fromName: string;
  fromRating?: number;
  /** When this stops being good, as an epoch millisecond. */
  expiresAt: number;
}

/**
 * An ask this player sent that somebody has taken up.
 *
 * Carries the room the *server* made at the moment of acceptance. Nothing
 * exists before that: an invite is a row, so the inviter is free to browse
 * while they wait rather than being pinned to a waiting screen holding a room
 * open with their socket.
 */
export interface AcceptedInvite {
  fromHandle: string;
  fromName: string;
  roomId: string;
}

/** `POST /api/me/presence` — the heartbeat, and how both halves arrive. */
export interface PresenceResponse {
  /** People asking this player for a game. */
  invites?: PendingInvite[];
  /** Asks this player sent that have been answered, each with its room. */
  accepted?: AcceptedInvite[];
}

/**
 * How long an invite lives, mirrored from the server.
 *
 * Used only to draw the countdown. The server decides whether an invite is
 * still good and this number has no part in that: a clock that is a few
 * seconds out would otherwise let a browser refuse something the server would
 * have accepted, or the reverse.
 */
export const INVITE_MS = 90_000;

/**
 * Why an invite could not be sent or taken up.
 *
 * The server sends both a sentence and a reason code. The sentence is what a
 * player reads; the code is what the client acts on, because matching against
 * wording would break the moment somebody improved it.
 */
export type InviteRefusal =
  | 'not-friends'
  | 'not-available'
  | 'expired'
  | 'gone'
  | 'already-playing'
  | 'too-many';

export interface InviteError {
  error: string;
  reason?: InviteRefusal;
}

/** `POST /api/invites/{handle}/accept` when it works. */
export interface AcceptResponse {
  roomId: string;
}

/**
 * Seconds left, floored, never negative.
 *
 * Floored rather than rounded so the number a player sees is a promise the
 * server can keep: rounding up would show "1" for four hundred milliseconds
 * that have already gone.
 */
export const secondsLeft = (invite: PendingInvite, now = Date.now()): number =>
  Math.max(0, Math.floor((invite.expiresAt - now) / 1000));
