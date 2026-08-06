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

import type { CountryCode } from './countries';
import type { Streak } from './streak';

import type { Cosmetic, EarnedCosmetic, PublicCosmetics } from './cosmetics';
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
    /**
     * This account's founder position, if it has one.
     *
     * Sent whether or not the star is currently worn, because the panel has to
     * draw the number in the preview the moment somebody selects the badge —
     * before anything is saved and before the server has been told.
     */
    founderNumber?: number;
  };
  /**
   * Time actually playing, in milliseconds. Measured per game by whoever
   * refereed it; seeded at the average duel length for games recorded before
   * measurement existed. Absent from an older server.
   */
  playMs?: number;
  /** Newest first, as the API stores it. */
  history: DuelResult[];
  /**
   * Where your rating puts you globally. Absent until a refereed duel has moved
   * it — unranked is not the same as last, and the dashboard must not say so on
   * somebody's first day.
   */
  rank?: GlobalRank;
  /** The country you chose to show, and your place in it. Absent until you pick. */
  country?: CountryCode;
  countryRank?: GlobalRank;
  /**
   * Your furthest survival run, and this week's sprint.
   *
   * Both here so the friends leaderboard can place you among your friends on
   * every board without a second round trip, and without the client assembling
   * "you" out of four different sources and getting one of them subtly wrong.
   * `weekly` is absent if you have not run this week's challenge.
   */
  bestStreak?: number;
  weekly?: { words: number; wpm: number; score: number };
  /**
   * The daily streak, and the calendar behind it.
   *
   * `current` arrives already resolved against the server's idea of today, not
   * read off storage: nothing writes on the days somebody does not play, so a
   * stored run would go on claiming itself forever. The client must not try to
   * recompute it from `calendar` for the same reason it must not decide the
   * date -- the server holds the clock everything was stamped against.
   */
  streak?: Streak;
  /**
   * The learning path: how far along, and where to go next.
   *
   * **Absent is the off switch.** The server omits this entirely unless
   * `LEARN_LIVE` is set, so its presence is what tells the client the feature
   * is open — there is no separate flag to keep in step and no way for the
   * menu to offer a path the API would refuse to record. A client that
   * decided this for itself would show a Learn button on production the day
   * before the curriculum was ready.
   *
   * `path` is one character per module, indexed by position in `MODULE_IDS`.
   * `next` is the first module not yet passed, or null when every one has
   * been — derived by the server rather than here, so the two cannot disagree
   * about what "next" means.
   */
  learn?: { path: string; next: string | null };
  /**
   * The offset the server dated those days against, so the browser can notice
   * it has gone stale and send a correction. See `syncClock`.
   */
  utcOffset?: number;
}

/**
 * Milliseconds of play as a card would say it.
 *
 * Hours and minutes, never seconds: this is a career total, and a figure that
 * ticks in seconds invites watching it tick. Under a minute reads as "<1m"
 * rather than zero, because a player who has genuinely played should never be
 * told they have not.
 */
export function formatPlayTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return ms > 0 ? '<1m' : '0m';
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
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
  /** The country as it now stands. Absent means there is none, not unchanged. */
  country?: CountryCode;
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
  /**
   * Already resolved to labels, files and colours by the server.
   *
   * The one thing on this card a player chose specifically in order to be seen
   * in it, so it is also the one addition that gave up nothing to include.
   */
  cosmetics?: PublicCosmetics;
  /**
   * Everything they have unlocked, in the order they earned it. What is worn
   * is a choice; this is the record behind it.
   */
  collection?: EarnedCosmetic[];
  /**
   * Public for the same reason the rating is: hours in the arena are
   * standing, not activity. A total never says when somebody last played,
   * which is the fact this card is careful not to give away.
   */
  playMs?: number;
  /**
   * Where they sit in the standings, counted by the server.
   *
   * Absent for somebody who has never finished a refereed duel, which is not
   * the same as last place and must not render as a number. `capped` means the
   * server stopped counting rather than that the figure is exact — see
   * RANK_CEILING in the API's lib/players.ts.
   */
  rank?: GlobalRank;
  /**
   * The country they chose to show, and where they sit within it.
   *
   * Both absent for a player who has not picked one, and that is not the same
   * as unranked: they have not lost a country board, they are not on one. The
   * card draws neither the chip nor the cell.
   */
  country?: CountryCode;
  countryRank?: GlobalRank;
  /**
   * Days running, and nothing more.
   *
   * The number is publishable in the way a rating is: persistence is standing.
   * The calendar behind it is not, and never leaves the owner's own route --
   * it is a precise map of when somebody sits at a keyboard, which is the fact
   * this card withholds duel history to avoid.
   */
  streak?: number;
  /**
   * Recent speeds, oldest first, for the profile sparkline.
   *
   * Deliberately a bare number[] with no timestamps. This card withholds duel
   * history because it says when somebody plays and who with; a list of speeds
   * with no clock attached says neither, which is the only reason it can be
   * published at all. Do not add dates to this — the whole design rests on
   * their absence.
   */
  recentWpm?: number[];
}

/** A position in the standings, and whether the server counted all the way. */
export interface GlobalRank {
  position: number;
  /** True when more players are above them than the server will count. */
  capped: boolean;
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
  /**
   * This was a module's boss, not a duel, so it is recorded nowhere.
   *
   * A boss is a bot duel by construction, which is exactly why it needs saying
   * out loud: `difficulty` on one is the tier the arena was built from and not
   * the speed the bot actually typed at, so anything counting practice wins by
   * difficulty would be counting a much easier fight. See `saveResult`.
   */
  boss?: boolean;
}
