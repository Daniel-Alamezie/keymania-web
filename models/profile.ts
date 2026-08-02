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

import type { Cosmetic } from './cosmetics';
import type { CharacterId } from './character';
import type { DuelStats } from './duel';
import type { Difficulty } from './bot';

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
  /**
   * Which bot, on practice duels. Absent on ranked duels and on any practice
   * duel recorded before the field existed — "missing" means unknown, and must
   * never be read as the easiest opponent.
   */
  difficulty?: Difficulty;
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
  /**
   * Standing among people. Starts mid-scale, moves only on human duels.
   *
   * Optional on the wire for an older server, never absent in practice — the
   * API resolves the default before answering, so a player who has never
   * duelled a person is still told where they stand.
   */
  rating?: number;
  /**
   * Every character this player may currently fight as.
   *
   * Derived on the server from the record, so it is always current and can
   * never disagree with what the endpoint will accept. The picker greys out
   * everything absent from here — a convenience, not the control; PUT /profile
   * refuses a locked character regardless of what the browser drew.
   */
  unlocked?: CharacterId[];
  /** Every open challenge, with progress. Absent from an older server. */
  challenges?: ChallengeProgress[];
  /**
   * The whole cosmetic catalogue, plus what this player owns and wears.
   *
   * The full list rather than only the earned ids, for the same reason the
   * challenge list above is sent whole: a panel showing only what you have
   * tells you nothing about what there is to want, which is the frustrating
   * half of a progression system with none of the pull.
   */
  cosmetics?: {
    catalogue: Cosmetic[];
    earned: string[];
    title?: string;
    badge?: string;
    nameColour?: string;
  };
  /** Newest first, as the API stores it. */
  history: DuelResult[];
}

/**
 * What finishing a challenge grants.
 *
 * A tagged union mirroring `Reward` in keymania-api. The cosmetic variant is
 * what lets a weekly challenge award something, since they cannot keep handing
 * out characters from a roster of six.
 */
export type Reward =
  | { kind: 'character'; character: CharacterId }
  /** A cosmetic, by id. The catalogue on the profile resolves what it means. */
  | { kind: 'cosmetic'; cosmetic: string };

/** One challenge and how far along it is, as `GET /profile` reports it. */
export interface ChallengeProgress {
  id: string;
  /** What the player is asked to do, in their words. */
  title: string;
  reward: Reward;
  /** How far along, already capped at `goal` by the server. */
  progress: number;
  goal: number;
  /** `count` renders "2 / 3"; `mark` renders done or not. */
  display: 'count' | 'mark';
  done: boolean;
  /** Present only on a challenge that closes, so a deadline can be shown. */
  endsAt?: number;
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
  /**
   * Public on purpose — a rating nobody else can see is a private score, and a
   * private score is not standing. It is also the least revealing thing here:
   * unlike history and practice, which are withheld because they say when
   * somebody last played and who with, this says only how they have done.
   */
  rating?: number;
}

/** `POST /api/me/duels` — a bot practice result, stored unranked. */
export interface ReportDuelRequest {
  wpm: number;
  accuracy: number;
  won: boolean;
  maxCombo: number;
  opponent?: string;
  /** Which bot. An older client omits it, and the server stores nothing. */
  difficulty?: Difficulty;
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
  /**
   * Which bot was played. Ignored when `multiplayer`, where the opponent was a
   * person and the server wrote the record itself.
   */
  difficulty: Difficulty;
}
