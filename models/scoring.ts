/**
 * Scoring: what a typed word is worth.
 *
 * These mirror `lib/scoring.ts` in keymania-api. The server's copy is the one
 * that counts — it owns health and damage — and this side runs the same rules
 * only to predict feedback instantly. If the two disagree, the server wins and
 * the player sees a correction.
 */

/** Blade size, grown by chaining words without a typo. */
export type BladeTier = 1 | 2 | 3 | 4 | 5;

/** One attempt at a word, as measured by the client. */
export interface WordAttempt {
  /** Characters typed, including the committing space. */
  characters: number;
  elapsedMs: number;
  /** Streak going into this word. */
  combo: number;
}

/** What an attempt earned. */
export interface DamageResult {
  damage: number;
  wpm: number;
  combo: number;
  tier: BladeTier;
  /** The streak crossed into a bigger blade — worth a flourish. */
  tierUp: boolean;
}
