/**
 * The player's record.
 *
 * Two of them, deliberately side by side so the difference is visible rather
 * than buried: `ServerProfile` is what the account holds and follows you
 * between devices; `LocalRecord` is this browser's own copy, which is all a
 * signed-out guest has and what the menu panels read for an instant update.
 *
 * ServerProfile mirrors the response of `GET /api/me/profile`, which proxies
 * `GET /profile` on keymania-api. See lib/upstream.ts for why it is proxied.
 */

import type { CharacterId } from './character';
import type { DuelStats } from './duel';

/** One finished duel, as stored in a player's history. */
export interface DuelResult {
  wpm: number;
  accuracy: number;
  won: boolean;
  at: number;
  /**
   * True only for duels the server refereed against a human.
   *
   * Bot practice runs entirely in the browser, so there is no server-side truth
   * behind it: it is kept for the player's own graph and can never reach the
   * leaderboard.
   */
  ranked: boolean;
  /** The other player, or "4-way" when there was a field rather than one rival. */
  opponent?: string;
}

/**
 * One column of the record.
 *
 * Ranked and practice are tallied separately because a combined figure is
 * farmable — the quickest route to a perfect win rate would be beating the
 * easiest bot on a loop.
 */
export interface Tally {
  duels: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  bestCombo: number;
}

/** `GET /api/me/profile`. */
export interface ServerProfile {
  displayName: string;
  /**
   * The unique name other players find you by.
   *
   * Optional only for the moment between an account existing and the server
   * seeding one, which it does on the first read of this endpoint. Anything
   * that links to a player needs this — a display name is not unique and can
   * never be used to address anybody.
   */
  handle?: string;
  /**
   * Who you fight as.
   *
   * Optional on the wire for an older server, never absent in practice — the
   * API resolves the default before answering, so a player who has never
   * opened the picker is still told who they currently look like.
   */
  character?: CharacterId;
  /** Duels against humans, refereed by the server. The record that counts. */
  ranked: Tally;
  /** Bot practice. Real progress, but the client reported it about itself. */
  practice: Tally;
  /** Best refereed speed — what the leaderboard orders on. */
  bestRankedWpm: number;
  /** Newest first, as the API stores it. */
  history: DuelResult[];
}

/**
 * `PUT /api/me/profile`.
 *
 * Both fields are optional and independent: sending one leaves the other
 * untouched. They are rationed very differently — a display name can change as
 * often as you like, a handle once a fortnight after the first free change.
 */
export interface UpdateProfileRequest {
  displayName?: string;
  handle?: string;
  character?: CharacterId;
}

export interface UpdateProfileResponse {
  displayName: string;
  handle?: string;
  character?: CharacterId;
  maxLength?: number;
  handleMaxLength?: number;
}

/**
 * `GET /api/players/{handle}` — somebody else's profile.
 *
 * A strict subset of ServerProfile, and the difference is the point. There is
 * no `history` here: it carries fifty duels tagged with opponent names, which
 * would tell a visitor who somebody plays with and when they were last at a
 * keyboard. `practice` is absent for the same reason — bot duels reveal
 * activity and interest nobody else.
 */
export interface PublicProfile {
  handle: string;
  displayName: string;
  ranked: Tally;
  bestRankedWpm: number;
}

/** `POST /api/me/duels` — a bot practice result, stored unranked. */
export interface ReportDuelRequest {
  wpm: number;
  accuracy: number;
  won: boolean;
  maxCombo: number;
  opponent?: string;
}

/**
 * This browser's own record, in localStorage.
 *
 * Kept whatever the sign-in state, because the menu panels read it and should
 * update the moment a duel ends rather than waiting on a round trip.
 */
export interface LocalRecord {
  name: string;
  duels: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  bestCombo: number;
  /** Most recent results, newest first. */
  recent: { wpm: number; accuracy: number; won: boolean; at: number }[];
}

/** What a finished duel hands to the recording layer. */
export interface FinishedDuel {
  stats: DuelStats;
  won: boolean;
  wpm: number;
  accuracy: number;
  signedIn: boolean;
  /** Absent for bot practice. */
  multiplayer: boolean;
}
