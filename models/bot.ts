/**
 * The practice opponent.
 *
 * Deliberately not machine learning, just timing. It completes words at a
 * target speed with human-ish jitter and the occasional fumble.
 */

/**
 * Every bot, easiest first.
 *
 * The order is load-bearing: the ladder opens in this sequence, and each tier's
 * unlock is expressed as a speed you have to have reached yourself. Sorting this
 * list to be tidy would reorder the ladder.
 *
 * A list rather than a hand-written union, so the roster can be iterated, and so
 * a contract test can compare it against the same list in
 * `keymania-api/src/lib/difficulty.ts`. That server never simulates a bot; it
 * only records which one was played, and it drops an id it does not recognise
 * rather than storing it. So a mismatch here is invisible: duels get recorded
 * with no opponent attached and progress towards an unlock simply never moves.
 */
export const DIFFICULTIES = [
  'rookie', 'rival', 'master', 'champion', 'virtuoso', 'apex',
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** A word the bot finished, as far as the duel is concerned. */
export interface BotWordEvent {
  characters: number;
  elapsedMs: number;
  /** 0 -> 1 progress through the bot's current sentence, for the HUD. */
  progress: number;
  /** The bot mistyped, which breaks its combo exactly like a player's. */
  fumbled: boolean;
}
