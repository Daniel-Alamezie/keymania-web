/**
 * The practice opponent.
 *
 * Deliberately not machine learning — just timing. It completes words at a
 * target speed with human-ish jitter and the occasional fumble.
 */

export type Difficulty = 'rookie' | 'rival' | 'master';

/** A word the bot finished, as far as the duel is concerned. */
export interface BotWordEvent {
  characters: number;
  elapsedMs: number;
  /** 0 -> 1 progress through the bot's current sentence, for the HUD. */
  progress: number;
  /** The bot mistyped, which breaks its combo exactly like a player's. */
  fumbled: boolean;
}
