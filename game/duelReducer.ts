import { applyDamage, bladeTier, keepsCombo, scoreWord, wpmFor } from './engine';
import { COUNTDOWN_FROM, MAX_HEALTH } from './constants';
import { OPENING_SENTENCE, randomSentence } from './sentences';
import { chargeSentence, MEND_AMOUNT, SURGE_MULTIPLIER, type PowerKind } from './powers';
import type { BladeTier, Difficulty, Phase, Side } from './types';

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
  opponentName: string;

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
  lastHit: { id: number; side: Side; damage: number; wpm: number; tier: BladeTier } | null;
  hitSeq: number;
  /** Bumped when the player forges a bigger blade, for the fanfare. */
  tierUpTick: number;
  stats: DuelStats;
  winner: Side | null;
}

export type DuelAction =
  | { type: 'start'; difficulty: Difficulty }
  | { type: 'startMulti'; script: string[]; opponentName: string; powers: Record<number, PowerKind> }
  | { type: 'countdown' }
  | { type: 'typed'; char: string; now: number }
  | { type: 'botWord'; characters: number; elapsedMs: number; progress: number; fumbled: boolean }
  /** `now` is passed in rather than read inside, keeping the reducer pure. */
  | { type: 'land'; target: Side; damage: number; now: number }
  /** Authoritative health from the server — never computed locally in multiplayer. */
  | { type: 'setHealths'; playerHealth: number; opponentHealth: number }
  | { type: 'setOpponentProgress'; progress: number }
  /** Authoritative power state from the server. */
  | { type: 'setPowers'; ward: boolean; surge: boolean; granted?: PowerKind; blocked?: boolean }
  | { type: 'finish'; winner: Side; now: number }
  | { type: 'reset' };

/** Sentences always end in a space so the final word is committed like any other. */
const freshSentence = (exclude?: string) => `${randomSentence(exclude)} `;

/** Re-key per-sentence charges into flat script coordinates. */
function shiftCharges(
  charges: Record<number, PowerKind>,
  offset: number,
): Record<number, PowerKind> {
  const out: Record<number, PowerKind> = {};
  for (const [index, kind] of Object.entries(charges)) out[Number(index) + offset] = kind;
  return out;
}

const emptyStats = (): DuelStats => ({
  wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0, bestWpm: 0, startedAt: 0, endedAt: 0,
});

export function initialState(difficulty: Difficulty = 'rival'): DuelState {
  return {
    phase: 'idle',
    difficulty,
    countdown: COUNTDOWN_FROM,
    multiplayer: false,
    script: null,
    scriptIndex: 0,
    opponentName: '',
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
    powers: {},
    wordOffset: 0,
    ward: false,
    surge: false,
    lastPower: null,
    blockTick: 0,
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
    case 'start': {
      const sentence = freshSentence();
      return {
        ...initialState(action.difficulty),
        phase: 'countdown',
        sentence,
        powers: chargeSentence(sentence.trim()),
      };
    }

    case 'startMulti':
      return {
        ...initialState(state.difficulty),
        phase: 'countdown',
        multiplayer: true,
        script: action.script,
        scriptIndex: 0,
        opponentName: action.opponentName,
        // The server decides which words are charged; we only render them.
        powers: action.powers,
        // Both players type the same words in the same order — the server sent
        // this script, and it also validates every submission against it.
        sentence: `${action.script[0]} `,
      };

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

      // The committing space is a keystroke too, and the measured time spans
      // it, so it counts toward the word's length. Standard typing measures
      // define a "word" as five characters *including* the space. Leaving it
      // out understates speed by 1/(n+1) — and because that fraction depends on
      // word length, short words would look slower than long ones at an
      // identical typing rate.
      const keystrokes = state.cursor - wordStart + 1;

      const combo = keepsCombo(action.now - state.lastWordAt) ? state.playerCombo : 0;
      const result = scoreWord({
        characters: keystrokes,
        elapsedMs: Math.max(1, action.now - state.wordStartedAt),
        combo,
      });

      const sentenceDone = advanced >= state.sentence.length;
      const wpm = wpmFor(keystrokes, Math.max(1, action.now - state.wordStartedAt));

      // Which word of the whole script this was, so charged words line up with
      // whatever the server marked.
      const localWord = state.sentence.slice(0, wordStart).split(' ').length - 1;
      const granted = state.powers[state.wordOffset + localWord];

      // Surge is spent on this throw, unless it is the power we just picked up.
      const spendSurge = state.surge && granted !== 'surge';
      const damage = spendSurge
        ? Math.round(result.damage * SURGE_MULTIPLIER * 10) / 10
        : result.damage;

      // Multiplayer walks the server's script in order so both sides stay in
      // step; solo play just picks another sentence at random.
      const nextIndex = sentenceDone ? state.scriptIndex + 1 : state.scriptIndex;
      const wordsThisSentence = state.sentence.trim().split(' ').length;
      const nextSentence = !sentenceDone
        ? state.sentence
        : state.script
          ? `${state.script[nextIndex % state.script.length]} `
          : freshSentence(state.sentence);

      // Solo charges each new sentence as it arrives; multiplayer already has
      // the whole script's charges from the server.
      const rolledOffset = sentenceDone ? state.wordOffset + wordsThisSentence : state.wordOffset;
      const nextPowers = sentenceDone && !state.script
        ? shiftCharges(chargeSentence(nextSentence.trim()), rolledOffset)
        : state.powers;

      return {
        ...state,
        sentence: nextSentence,
        scriptIndex: nextIndex,
        wordOffset: rolledOffset,
        powers: nextPowers,
        cursor: sentenceDone ? 0 : advanced,
        playerCombo: result.combo,
        wordStartedAt: action.now,
        lastWordAt: action.now,
        hitSeq: state.hitSeq + 1,
        tierUpTick: result.tierUp ? state.tierUpTick + 1 : state.tierUpTick,
        // Powers only resolve locally in solo; in multiplayer the server's
        // `setPowers` overwrites this with the authoritative state.
        ward: granted === 'ward' ? true : state.ward,
        surge: granted === 'surge' ? true : spendSurge ? false : state.surge,
        playerHealth: granted === 'mend'
          ? Math.min(MAX_HEALTH, state.playerHealth + MEND_AMOUNT)
          : state.playerHealth,
        lastPower: granted ? { kind: granted, tick: action.now } : state.lastPower,
        lastHit: {
          id: state.hitSeq + 1,
          side: 'player',
          damage,
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

      // A ward absorbs the blade entirely and is consumed doing so.
      if (action.target === 'player' && state.ward) {
        return { ...state, ward: false, blockTick: state.blockTick + 1 };
      }

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
        // Freeze the clock the moment it is decided, so the results are settled.
        stats: winner ? { ...state.stats, endedAt: action.now } : state.stats,
      };
    }

    case 'setHealths': {
      if (state.phase === 'over') return state;
      return {
        ...state,
        playerHealth: action.playerHealth,
        opponentHealth: action.opponentHealth,
      };
    }

    case 'setOpponentProgress':
      return { ...state, opponentProgress: action.progress };

    case 'setPowers':
      return {
        ...state,
        ward: action.ward,
        surge: action.surge,
        blockTick: action.blocked ? state.blockTick + 1 : state.blockTick,
        lastPower: action.granted
          ? { kind: action.granted, tick: Date.now() }
          : state.lastPower,
      };

    case 'finish':
      return {
        ...state,
        phase: 'over',
        winner: action.winner,
        stats: { ...state.stats, endedAt: state.stats.endedAt || action.now },
      };

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

/** Overall words-per-minute across the whole duel, live. */
export function overallWpm(stats: DuelStats, now: number): number {
  if (!stats.startedAt) return 0;
  return Math.round(wpmFor(stats.charsTyped, now - stats.startedAt));
}

/**
 * The duel's settled speed — the figure worth ranking.
 *
 * Uses the frozen end time rather than the clock: computing this live on a
 * results screen would make the number fall steadily as the player sat there,
 * since elapsed time keeps growing while the character count does not.
 *
 * Preferred over `bestWpm` for any leaderboard. A single fast short word is
 * mostly luck; sustained speed over a whole duel is the actual skill. Note that
 * because a wrong key never advances the cursor, mistakes already cost time —
 * so this figure honestly reflects accuracy without needing a separate penalty.
 */
export function finalWpm(stats: DuelStats): number {
  if (!stats.startedAt || !stats.endedAt) return 0;
  return Math.round(wpmFor(stats.charsTyped, stats.endedAt - stats.startedAt));
}
