/** Blade power tiers, 1 (shiv) through 5 (legendary). Maps to sprite assets. */
export type BladeTier = 1 | 2 | 3 | 4 | 5;

export type Side = 'player' | 'opponent';

/**
 * `finishing` is the beat between the killing blow and the result screen.
 *
 * The duel is already decided — the winner is set and the clock is stopped —
 * but the arena is still on screen: the loser falls, the light drains, and only
 * then does the banner land. Without it the whole thing cuts from mid-fight to
 * a statistics panel in a single frame, which is the one moment in a duel that
 * should not feel like closing a spreadsheet.
 */
export type Phase = 'idle' | 'countdown' | 'playing' | 'finishing' | 'over';

export type Difficulty = 'rookie' | 'rival' | 'master';

/** A single completed word, ready to be scored. */
export interface WordAttempt {
  /** Number of characters in the word (excluding the trailing space). */
  characters: number;
  /** Milliseconds taken to type it. */
  elapsedMs: number;
  /** Combo count *before* this word landed. */
  combo: number;
}

/** The scored result of a completed word. */
export interface DamageResult {
  damage: number;
  wpm: number;
  combo: number;
  tier: BladeTier;
  /** True when this word pushed the player into a higher blade tier. */
  tierUp: boolean;
}

/** A dagger in flight, owned by the effects layer. */
export interface Projectile {
  id: number;
  from: Side;
  tier: BladeTier;
  damage: number;
  /** 0 -> 1 progress across the arena. */
  progress: number;
}

export interface FighterState {
  health: number;
  combo: number;
  /** Index of the next character to type within the sentence. */
  cursor: number;
}
