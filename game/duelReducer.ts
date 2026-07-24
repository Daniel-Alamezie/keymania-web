import { applyDamage, bladeTier, keepsCombo, scoreWord, wpmFor } from './engine';
import { COUNTDOWN_FROM, MAX_HEALTH } from './constants';
import { OPENING_SENTENCE, randomSentence } from './sentences';
import type { BladeTier, Difficulty, Phase, Side } from './types';

export interface DuelStats {
  wordsTyped: number;
  charsTyped: number;
  mistakes: number;
  maxCombo: number;
  bestWpm: number;
  startedAt: number;
}

export interface DuelState {
  phase: Phase;
  difficulty: Difficulty;
  countdown: number;

  /** Always carries a trailing space so every word is committed with SPACE. */
  sentence: string;
  cursor: number;
  wordStartedAt: number;
  lastWordAt: number;

  playerHealth: number;
  opponentHealth: number;
  playerCombo: number;
  opponentCombo: number;
  opponentProgress: number;

  missTick: number;
  lastHit: { id: number; side: Side; damage: number; wpm: number; tier: BladeTier } | null;
  hitSeq: number;
  /** Bumped when the player forges a bigger blade, for the fanfare. */
  tierUpTick: number;
  stats: DuelStats;
  winner: Side | null;
}

export type DuelAction =
  | { type: 'start'; difficulty: Difficulty }
  | { type: 'countdown' }
  | { type: 'typed'; char: string; now: number }
  | { type: 'botWord'; characters: number; elapsedMs: number; progress: number; fumbled: boolean }
  | { type: 'land'; target: Side; damage: number }
  | { type: 'reset' };

/** Sentences always end in a space so the final word is committed like any other. */
const freshSentence = (exclude?: string) => `${randomSentence(exclude)} `;

const emptyStats = (): DuelStats => ({
  wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0, bestWpm: 0, startedAt: 0,
});

export function initialState(difficulty: Difficulty = 'rival'): DuelState {
  return {
    phase: 'idle',
    difficulty,
    countdown: COUNTDOWN_FROM,
    // Fixed, not random — this state is server-rendered too (see OPENING_SENTENCE).
    sentence: `${OPENING_SENTENCE} `,
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
    tierUpTick: 0,
    stats: emptyStats(),
    winner: null,
  };
}

export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'start':
      return { ...initialState(action.difficulty), phase: 'countdown', sentence: freshSentence() };

    case 'countdown': {
      if (state.phase !== 'countdown') return state;
      const next = state.countdown - 1;
      if (next > 0) return { ...state, countdown: next };
      const now = Date.now();
      return {
        ...state,
        phase: 'playing',
        countdown: 0,
        wordStartedAt: now,
        lastWordAt: now,
        stats: { ...emptyStats(), startedAt: now },
      };
    }

    case 'typed': {
      if (state.phase !== 'playing') return state;
      const expected = state.sentence[state.cursor];

      if (action.char !== expected) {
        return {
          ...state,
          playerCombo: 0,
          missTick: state.missTick + 1,
          stats: { ...state.stats, mistakes: state.stats.mistakes + 1 },
        };
      }

      const advanced = state.cursor + 1;
      const stats = { ...state.stats, charsTyped: state.stats.charsTyped + 1 };

      // Mid-word: just advance the cursor.
      if (expected !== ' ') {
        return { ...state, cursor: advanced, stats };
      }

      // SPACE committed the word — score everything that came before it.
      const wordStart = state.sentence.lastIndexOf(' ', state.cursor - 1) + 1;
      const characters = state.cursor - wordStart;
      const combo = keepsCombo(action.now - state.lastWordAt) ? state.playerCombo : 0;
      const result = scoreWord({
        characters,
        elapsedMs: Math.max(1, action.now - state.wordStartedAt),
        combo,
      });

      const sentenceDone = advanced >= state.sentence.length;
      const wpm = wpmFor(characters, Math.max(1, action.now - state.wordStartedAt));

      return {
        ...state,
        sentence: sentenceDone ? freshSentence(state.sentence) : state.sentence,
        cursor: sentenceDone ? 0 : advanced,
        playerCombo: result.combo,
        wordStartedAt: action.now,
        lastWordAt: action.now,
        hitSeq: state.hitSeq + 1,
        tierUpTick: result.tierUp ? state.tierUpTick + 1 : state.tierUpTick,
        lastHit: {
          id: state.hitSeq + 1,
          side: 'player',
          damage: result.damage,
          wpm: result.wpm,
          tier: result.tier,
        },
        stats: {
          ...stats,
          wordsTyped: stats.wordsTyped + 1,
          maxCombo: Math.max(stats.maxCombo, result.combo),
          bestWpm: Math.max(stats.bestWpm, Math.round(wpm)),
        },
      };
    }

    case 'botWord': {
      if (state.phase !== 'playing') return state;
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

      return { ...state, playerHealth, opponentHealth, phase: winner ? 'over' : state.phase, winner };
    }

    case 'reset':
      return initialState(state.difficulty);

    default:
      return state;
  }
}

export function currentTier(state: DuelState): BladeTier {
  return bladeTier(state.playerCombo);
}

/** Accuracy as a percentage of keystrokes that landed correctly. */
export function accuracy(stats: DuelStats): number {
  const total = stats.charsTyped + stats.mistakes;
  return total === 0 ? 100 : Math.round((stats.charsTyped / total) * 100);
}

/** Overall words-per-minute across the whole duel. */
export function overallWpm(stats: DuelStats, now: number): number {
  if (!stats.startedAt) return 0;
  return Math.round(wpmFor(stats.charsTyped, now - stats.startedAt));
}
