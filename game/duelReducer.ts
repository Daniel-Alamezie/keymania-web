import { applyDamage, bladeTier, keepsCombo, scoreWord } from './engine';
import { COUNTDOWN_FROM, MAX_HEALTH } from './constants';
import { randomSentence } from './sentences';
import type { BladeTier, Difficulty, Phase, Side } from './types';

export interface DuelState {
  phase: Phase;
  difficulty: Difficulty;
  countdown: number;

  sentence: string;
  cursor: number;
  /** When the current word was started, for speed scoring. */
  wordStartedAt: number;
  /** When the previous word landed, for combo-window checks. */
  lastWordAt: number;

  playerHealth: number;
  opponentHealth: number;
  playerCombo: number;
  opponentCombo: number;
  opponentProgress: number;

  /** Bumped on every typo so the UI can retrigger its shake animation. */
  missTick: number;
  /**
   * The most recent scored word. Carries a monotonic `id` so the effect that
   * launches blades can process each hit exactly once — without it, React's
   * double-invoked effects could double-schedule a landing, and a cleanup-based
   * fix would cancel a pending landing whenever a second word lands first.
   */
  lastHit: { id: number; side: Side; damage: number; wpm: number; tier: BladeTier } | null;
  hitSeq: number;
  winner: Side | null;
}

export type DuelAction =
  | { type: 'start'; difficulty: Difficulty }
  | { type: 'countdown' }
  | { type: 'typed'; char: string; now: number }
  | { type: 'botWord'; characters: number; elapsedMs: number; progress: number; fumbled: boolean }
  | { type: 'land'; target: Side; damage: number }
  | { type: 'reset' };

export function initialState(difficulty: Difficulty = 'rival'): DuelState {
  return {
    phase: 'idle',
    difficulty,
    countdown: COUNTDOWN_FROM,
    sentence: randomSentence(),
    cursor: 0,
    wordStartedAt: 0,
    lastWordAt: 0,
    playerHealth: MAX_HEALTH,
    opponentHealth: MAX_HEALTH,
    playerCombo: 0,
    opponentCombo: 0,
    opponentProgress: 0,
    missTick: 0,
    lastHit: null,
    hitSeq: 0,
    winner: null,
  };
}

/** Advance past the space that follows a completed word. */
function skipSpace(sentence: string, cursor: number): number {
  return sentence[cursor] === ' ' ? cursor + 1 : cursor;
}

export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'start':
      return {
        ...initialState(action.difficulty),
        phase: 'countdown',
        sentence: randomSentence(),
      };

    case 'countdown': {
      if (state.phase !== 'countdown') return state;
      const next = state.countdown - 1;
      if (next > 0) return { ...state, countdown: next };
      const now = Date.now();
      return { ...state, phase: 'playing', countdown: 0, wordStartedAt: now, lastWordAt: now };
    }

    case 'typed': {
      if (state.phase !== 'playing') return state;
      const expected = state.sentence[state.cursor];

      // Stray spaces are ignored rather than punished — words auto-advance.
      if (action.char === ' ' && expected !== ' ') return state;

      if (action.char !== expected) {
        return { ...state, playerCombo: 0, missTick: state.missTick + 1 };
      }

      const advanced = state.cursor + 1;
      const finishedWord = advanced >= state.sentence.length || state.sentence[advanced] === ' ';
      if (!finishedWord) return { ...state, cursor: advanced };

      // Score the word that just landed.
      const combo = keepsCombo(action.now - state.lastWordAt) ? state.playerCombo : 0;
      const characters = advanced - (state.sentence.lastIndexOf(' ', state.cursor) + 1);
      const result = scoreWord({
        characters,
        elapsedMs: Math.max(1, action.now - state.wordStartedAt),
        combo,
      });

      const cursor = skipSpace(state.sentence, advanced);
      const sentenceDone = cursor >= state.sentence.length;

      return {
        ...state,
        sentence: sentenceDone ? randomSentence(state.sentence) : state.sentence,
        cursor: sentenceDone ? 0 : cursor,
        playerCombo: result.combo,
        wordStartedAt: action.now,
        lastWordAt: action.now,
        hitSeq: state.hitSeq + 1,
        lastHit: {
          id: state.hitSeq + 1,
          side: 'player',
          damage: result.damage,
          wpm: result.wpm,
          tier: result.tier,
        },
      };
    }

    case 'botWord': {
      if (state.phase !== 'playing') return state;
      // A fumble breaks the bot's streak exactly as a typo breaks the player's.
      const combo = action.fumbled ? 0 : state.opponentCombo;
      const result = scoreWord({ characters: action.characters, elapsedMs: action.elapsedMs, combo });
      return {
        ...state,
        opponentCombo: result.combo,
        opponentProgress: action.progress,
        hitSeq: state.hitSeq + 1,
        lastHit: {
          id: state.hitSeq + 1,
          side: 'opponent',
          damage: result.damage,
          wpm: result.wpm,
          tier: result.tier,
        },
      };
    }

    case 'land': {
      if (state.phase !== 'playing') return state;
      const playerHealth = action.target === 'player'
        ? applyDamage(state.playerHealth, action.damage)
        : state.playerHealth;
      const opponentHealth = action.target === 'opponent'
        ? applyDamage(state.opponentHealth, action.damage)
        : state.opponentHealth;

      const winner: Side | null =
        opponentHealth <= 0 ? 'player' : playerHealth <= 0 ? 'opponent' : null;

      return {
        ...state,
        playerHealth,
        opponentHealth,
        phase: winner ? 'over' : state.phase,
        winner,
      };
    }

    case 'reset':
      return initialState(state.difficulty);

    default:
      return state;
  }
}

/** Convenience selector: the blade the player is currently charging. */
export function currentTier(state: DuelState): BladeTier {
  return bladeTier(state.playerCombo);
}
