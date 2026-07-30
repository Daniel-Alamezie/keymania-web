import { CAPACITY_MS } from './heat';
import { OPENING_SENTENCE } from './sentences';

/**
 * A survival run, as the client sees it.
 *
 * Its own state machine rather than a mode inside `duelReducer`, because the two
 * share almost nothing. There is no health, no damage, no opponent, no target,
 * no powers and no elimination: a run is a position in a stream of words, how
 * far you have got, and how hot the forge is. Threading that through a machine
 * built for a fight meant lying to it, and the first draft did exactly that by
 * ending a run with `winnerSlot: -1` when there is no winner to name.
 *
 * The server is still the referee. This advances optimistically so the screen
 * responds to a keystroke immediately, and every word is confirmed, corrected or
 * ended by the message that comes back.
 */

export type SurvivalEnd = 'typo' | 'cold';

export interface SurvivalState {
  phase: 'countdown' | 'running' | 'over';
  countdown: number;

  /* The stream, shaped exactly as SentenceView wants it. */
  previous: string;
  sentence: string;
  upcoming: string;
  cursor: number;
  wordOffset: number;
  /** Bumped on a wrong key, so the line can flinch. */
  missTick: number;

  /**
   * Every sentence the server has committed to, in order.
   *
   * Held rather than generated, because the server validates each word against
   * its own copy and a client inventing its own would disagree on the first word
   * of the first sentence it made up. It grows: the server appends as a run goes
   * on and says so, since ten sentences is about eighty words and a good run
   * passes that.
   */
  script: string[];
  scriptIndex: number;

  /* The run itself. */
  /** Words survived, which in sudden death is also the score. */
  words: number;
  heat: number;
  cooling: number;
  charsTyped: number;
  /**
   * When the first key landed, not when the run was armed.
   *
   * The countdown, the connection and the render all happen before anybody
   * types, and counting them would report a speed nobody achieved. Zero until
   * the first keystroke sets it.
   */
  startedAt: number;
  wordStartedAt: number;
  /** When it ended, so the final speed is not recomputed on every render. */
  finishedAt: number;
  ended: SurvivalEnd | null;
}

export type SurvivalAction =
  | { type: 'begin'; script: string[] }
  | { type: 'countdown' }
  | { type: 'typed'; char: string; now: number }
  /** The server's word on the last word, including where the forge stands. */
  | { type: 'confirm'; heat: number; cooling: number; words: number; appended?: string }
  | { type: 'end'; reason: SurvivalEnd; now: number };

export function initialSurvival(): SurvivalState {
  return {
    phase: 'countdown',
    countdown: 3,
    previous: '',
    sentence: `${OPENING_SENTENCE} `,
    upcoming: '',
    cursor: 0,
    wordOffset: 0,
    missTick: 0,
    script: [],
    scriptIndex: 0,
    words: 0,
    heat: CAPACITY_MS,
    cooling: 1,
    charsTyped: 0,
    startedAt: 0,
    wordStartedAt: 0,
    finishedAt: 0,
    ended: null,
  };
}

/** Sentences carry a trailing space, so the committing key is always a space. */
const withSpace = (sentence: string) => `${sentence} `;

/**
 * A number the server sent, or the one we already had.
 *
 * The confirmation arrives over a socket, from a different repo, on its own
 * deploy schedule. The type says `number` and the type is a promise about a
 * message this file never validated: the server shipped sending its judgement
 * nested one level down, `heat` arrived as `undefined`, and it went straight
 * into state, out to the bar, and into `element.animate()`, which threw and took
 * the whole run screen with it.
 *
 * Keeping the last good value is the right failure: the run carries on against
 * a slightly stale forge, which is what happens between words anyway, instead of
 * ending on a number that was never really there.
 */
const orKeep = (sent: number, current: number) => (Number.isFinite(sent) ? sent : current);

export function survivalReducer(state: SurvivalState, action: SurvivalAction): SurvivalState {
  switch (action.type) {
    case 'begin':
      return {
        ...initialSurvival(),
        script: action.script,
        sentence: withSpace(action.script[0] ?? OPENING_SENTENCE),
        upcoming: withSpace(action.script[1] ?? ''),
      };

    case 'countdown': {
      if (state.phase !== 'countdown') return state;
      const left = state.countdown - 1;
      return left > 0
        ? { ...state, countdown: left }
        : { ...state, countdown: 0, phase: 'running' };
    }

    case 'typed': {
      if (state.phase !== 'running') return state;

      const expected = state.sentence[state.cursor];

      /**
       * A wrong key is the end, not a setback.
       *
       * This is the whole mode. In a duel a typo costs you a combo and you carry
       * on; here there is nothing to carry on to. `missTick` still moves so the
       * line flinches, because the player deserves to see the keystroke that did
       * it rather than only the result screen.
       */
      if (action.char !== expected) {
        return {
          ...state,
          phase: 'over',
          ended: 'typo',
          finishedAt: action.now,
          missTick: state.missTick + 1,
        };
      }

      const advanced = state.cursor + 1;
      const charsTyped = state.charsTyped + 1;
      /**
       * The clock starts on the first key, not when the run was armed.
       *
       * The countdown, the socket and the first render all happen before anybody
       * types, and counting them would report a speed nobody achieved.
       */
      const startedAt = state.startedAt || action.now;
      /**
       * The first word's clock starts on its first key too.
       *
       * A duel stamps this when the countdown ends, which survival cannot copy:
       * its `countdown` action carries no `now`, deliberately, so the reducer
       * stays pure. Left at zero, the first word's elapsed time came out as the
       * whole of the Unix epoch, and the server clamped that to its ceiling and
       * scored the opening word of every run as the slowest one ever typed.
       */
      const wordStartedAt = state.wordStartedAt || action.now;

      // Mid-word: nothing to report, just move.
      if (expected !== ' ') {
        return { ...state, cursor: advanced, charsTyped, startedAt, wordStartedAt };
      }

      /**
       * A space committed the word.
       *
       * The count goes up here optimistically. The server decides whether the
       * forge survived it and will say so, which is the same arrangement the
       * arena uses for damage: predict, then be corrected.
       */
      const sentenceDone = advanced >= state.sentence.length;
      const wordsInSentence = state.sentence.trim().split(' ').length;

      if (!sentenceDone) {
        return {
          ...state,
          cursor: advanced,
          charsTyped,
          startedAt,
          words: state.words + 1,
          wordStartedAt: action.now,
        };
      }

      const nextIndex = state.scriptIndex + 1;
      return {
        ...state,
        previous: state.sentence,
        sentence: withSpace(state.script[nextIndex] ?? ''),
        upcoming: withSpace(state.script[nextIndex + 1] ?? ''),
        scriptIndex: nextIndex,
        wordOffset: state.wordOffset + wordsInSentence,
        cursor: 0,
        charsTyped,
        startedAt,
        words: state.words + 1,
        wordStartedAt: action.now,
      };
    }

    /**
     * What the referee actually saw.
     *
     * Heat is the interesting one: it is measured between two timestamps the
     * server wrote, so unlike the typo it is not a claim. `appended` carries any
     * sentence the server added while topping the script up, without which a
     * long run walks off the end of the words it was given.
     */
    case 'confirm':
      if (state.phase === 'over') return state;
      return {
        ...state,
        heat: orKeep(action.heat, state.heat),
        cooling: orKeep(action.cooling, state.cooling),
        words: orKeep(action.words, state.words),
        script: action.appended ? [...state.script, action.appended] : state.script,
        // A sentence that arrived after the stream had already rolled onto it.
        upcoming: state.upcoming.trim() === '' && action.appended
          ? withSpace(action.appended)
          : state.upcoming,
      };

    case 'end':
      if (state.phase === 'over') return state;
      return { ...state, phase: 'over', ended: action.reason, finishedAt: action.now, heat: 0 };

    default:
      return state;
  }
}

/** Words per minute across the whole run, on the standard five-character word. */
export function survivalWpm(state: SurvivalState, now: number): number {
  const elapsed = now - state.startedAt;
  if (elapsed <= 0 || state.charsTyped === 0) return 0;
  return Math.round(state.charsTyped / 5 / (elapsed / 60_000));
}
