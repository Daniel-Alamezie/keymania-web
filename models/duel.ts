/**
 * The duel itself: who is in it, what happens to them, and what state that
 * leaves the screen in.
 *
 * Everything here is addressed by **slot** rather than by side, because that is
 * the language the server speaks — it sends healths[], progress[] and targets[]
 * indexed by slot. Translating those into "player and opponent" at the boundary
 * is what produced every index bug this codebase has had.
 */

import type { CharacterId } from './character';
import type { BladeTier } from './scoring';
import type { Difficulty } from './bot';
import type { PowerKind } from './powers';

/**
 * `finishing` is the beat between the killing blow and the result screen: the
 * duel is decided and the clock is stopped, but the arena is still on screen
 * while the loser falls.
 */
export type Phase = 'idle' | 'countdown' | 'playing' | 'finishing' | 'over';

/**
 * Which half of the arena something belongs to.
 *
 * Purely presentational — you are always drawn on the left and everyone else on
 * the right. Damage is addressed by slot, never by this.
 */
export type Side = 'player' | 'opponent';

/** One fighter in the duel. */
export interface Fighter {
  name: string;
  /** Which sprite draws them. Defaulted for bots and older servers. */
  character: CharacterId;
  health: number;
  combo: number;
  /** How far through the current sentence they are, 0..1, for the HUD. */
  progress: number;
  /** The slot their blade currently flies at, or -1 if nobody is left. */
  target: number;
}

export interface DuelStats {
  wordsTyped: number;
  charsTyped: number;
  mistakes: number;
  maxCombo: number;
  /** Fastest single word. A burst figure — see `finalWpm` for the honest one. */
  bestWpm: number;
  startedAt: number;
  /** Frozen when the duel ends, so results stop moving once they are shown. */
  endedAt: number;
}

export interface DuelState {
  phase: Phase;
  difficulty: Difficulty;
  countdown: number;

  /** Multiplayer duels are driven by the server rather than a local bot. */
  multiplayer: boolean;
  /** The shared word script sent by the server; null in solo play. */
  script: string[] | null;
  scriptIndex: number;

  /** Everyone in the duel, in the server's slot order — including you. */
  fighters: Fighter[];
  /** Which slot is you. Always 0 in solo. */
  mySlot: number;

  /**
   * The sentence just finished, kept so the stream has something trailing off
   * to the left after a roll rather than starting from a bare edge.
   */
  previous: string;
  /** Always carries a trailing space so every word is committed with SPACE. */
  sentence: string;
  /**
   * The sentence after this one, known before it is needed.
   *
   * The text is rendered as a moving stream, so there has to be something to
   * flow in from the right — without this the strip would run out at the end of
   * the current sentence and the next would appear from nowhere. Empty while
   * idle, which also keeps the server-rendered state deterministic.
   */
  upcoming: string;
  cursor: number;
  wordStartedAt: number;
  lastWordAt: number;

  /** Your own streak. Singular because there is only ever one of you. */
  playerCombo: number;
  /**
   * Typos made in the word currently being typed, reset on each commit.
   *
   * Reported to the server so its combo can break on a mistake too. Without it
   * the server never learns a typo happened at all — a wrong key does not
   * advance the cursor, so no message is ever sent for it — and its streak runs
   * on where yours has visibly broken.
   */
  wordMistakes: number;

  /** Charged words, keyed by flat word index across the whole script. */
  powers: Record<number, PowerKind>;
  /** Flat index of the first word of the current sentence. */
  wordOffset: number;
  /** Absorbs the next blade aimed at you. */
  ward: boolean;
  /** Doubles your next throw. */
  surge: boolean;
  /** Most recent power collected, for the pickup flourish. */
  lastPower: { kind: PowerKind; tick: number } | null;
  /** Bumped when a ward absorbs a blade. */
  blockTick: number;

  missTick: number;
  lastHit: {
    id: number;
    /**
     * Who threw it and who wore it. Both are needed: with more than two
     * fighters neither can be inferred from the other.
     */
    fromSlot: number;
    toSlot: number;
    damage: number;
    wpm: number;
    tier: BladeTier;
  } | null;
  hitSeq: number;
  /** Bumped when the player forges a bigger blade, for the fanfare. */
  tierUpTick: number;
  stats: DuelStats;
  /** Winning slot, or null while it is still live. Note slot 0 is falsy. */
  winner: number | null;
}

export type DuelAction =
  | {
      type: 'start';
      difficulty: Difficulty;
      /**
       * Who the player fights as, read from their profile at the moment they
       * press start.
       *
       * Carried on the action rather than baked into `initialState`, which is
       * server-rendered and must not depend on a profile the server has not
       * fetched. Optional so a caller without a loaded profile still gets a
       * duel, wearing the default.
       */
      character?: CharacterId;
    }
  | {
      type: 'startMulti';
      script: string[];
      /** Every player's name in slot order. */
      roster: string[];
      /** Parallel to the roster; defaults fill in for an older server. */
      /**
       * Required, though it may be undefined.
       *
       * An optional key let three separate layers quietly drop this on the way
       * from the socket to the reducer, and nothing complained — the server
       * sent it, the reducer read it, and every hop in between simply did not
       * mention it. A required key that accepts `undefined` costs a caller one
       * word and makes forgetting it a type error rather than a bug report
       * about everybody looking identical.
       */
      characters: CharacterId[] | undefined;
      mySlot: number;
      powers: Record<number, PowerKind>;
    }
  | { type: 'countdown' }
  | { type: 'typed'; char: string; now: number }
  | { type: 'botWord'; characters: number; elapsedMs: number; progress: number; fumbled: boolean }
  /** `now` is passed in rather than read inside, keeping the reducer pure. */
  | { type: 'land'; toSlot: number; damage: number; now: number }
  /** Authoritative health from the server — never computed locally in multiplayer. */
  | { type: 'setHealths'; healths: number[] }
  /** Who each fighter is currently aiming at, recomputed by the server. */
  | {
      /**
       * A stagger broke somebody's streak. Slot-addressed because it may be
       * yours — in which case the local combo, not a fighter's, is the one
       * that has to stop.
       */
      type: 'staggered';
      slot: number;
    }
  | { type: 'setTargets'; targets: number[] }
  | { type: 'setProgress'; slot: number; progress: number }
  /** Authoritative power state from the server. */
  | { type: 'setPowers'; ward: boolean; surge: boolean; granted?: PowerKind; blocked?: boolean }
  | { type: 'finish'; winnerSlot: number; now: number }
  /** The finishing beat is done (or was skipped); show the result. */
  | { type: 'settle' }
  | { type: 'reset' };
