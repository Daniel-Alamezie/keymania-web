import { OPENING_SENTENCE } from './sentences';

/**
 * A weekly sprint, as the client sees it.
 *
 * Survival's sibling, not its twin, and the two differences are the mode:
 *
 *  - **A typo is a setback, not the end.** The line flinches and the cursor
 *    stays; the cost is the seconds spent recovering, which is the only
 *    currency a timed sprint has. Ending the run on a slip would make thirty
 *    seconds of all-out typing unplayable.
 *  - **The clock is the opponent.** There is no forge and no cooling curve —
 *    just thirty seconds from the first keystroke, enforced independently by
 *    the server against timestamps it wrote itself.
 *
 * The server is still the referee: this advances optimistically so the screen
 * responds to a keystroke immediately, and the figures on the end card come
 * from the weeklyEnd message, never from local arithmetic.
 */

export interface WeeklyState {
  phase: 'countdown' | 'running' | 'over';
  countdown: number;

  /* The stream, shaped exactly as SentenceView wants it. */
  previous: string;
  sentence: string;
  upcoming: string;
  cursor: number;
  wordOffset: number;
  missTick: number;

  /** The week's script, fixed for everybody. It never grows. */
  script: string[];
  scriptIndex: number;

  /** Words committed locally. The board only ever hears the server's count. */
  words: number;
  charsTyped: number;
  /** The first keystroke, which is when the thirty seconds begin locally. */
  startedAt: number;
  wordStartedAt: number;
  finishedAt: number;
}

export type WeeklyAction =
  | { type: 'begin'; script: string[] }
  | { type: 'countdown' }
  | { type: 'typed'; char: string; now: number }
  /** The referee's word count, so a lost message cannot let the two drift. */
  | { type: 'confirm'; words: number }
  | { type: 'end'; now: number };

export function initialWeekly(): WeeklyState {
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
    charsTyped: 0,
    startedAt: 0,
    wordStartedAt: 0,
    finishedAt: 0,
  };
}

const withSpace = (sentence: string) => `${sentence} `;

/** The word under the cursor, for reporting on commit. */
export function currentWeeklyWord(state: WeeklyState): string {
  const start = state.sentence.lastIndexOf(' ', state.cursor - 1) + 1;
  const end = state.sentence.indexOf(' ', state.cursor);
  return state.sentence.slice(start, end === -1 ? undefined : end);
}

export function weeklyReducer(state: WeeklyState, action: WeeklyAction): WeeklyState {
  switch (action.type) {
    case 'begin':
      return {
        ...initialWeekly(),
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
      if (state.sentence.trim() === '') return state;

      const expected = state.sentence[state.cursor];

      /**
       * Wrong key: flinch and stay. No death, no reset to the word's start —
       * the mistake has already cost the time it took, and any further
       * punishment would be the reducer inventing a rule the referee does not
       * hold. The server never hears about it, because nothing was committed.
       */
      if (action.char !== expected) {
        return { ...state, missTick: state.missTick + 1 };
      }

      const advanced = state.cursor + 1;
      const charsTyped = state.charsTyped + 1;
      // The thirty seconds start on the first key, not on the countdown.
      const startedAt = state.startedAt || action.now;
      const wordStartedAt = state.wordStartedAt || action.now;

      if (expected !== ' ') {
        return { ...state, cursor: advanced, charsTyped, startedAt, wordStartedAt };
      }

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

      /**
       * Off the end of the script and round again — the same wrap the referee
       * applies. The bank makes every passage longer than thirty seconds can
       * eat, so this is a backstop for the one typist who proves that wrong
       * rather than a loop anybody should ever see.
       */
      const nextIndex = (state.scriptIndex + 1) % state.script.length;

      return {
        ...state,
        previous: state.sentence,
        sentence: withSpace(state.script[nextIndex] ?? ''),
        upcoming: withSpace(state.script[(nextIndex + 1) % state.script.length] ?? ''),
        scriptIndex: nextIndex,
        wordOffset: state.wordOffset + wordsInSentence,
        cursor: 0,
        charsTyped,
        startedAt,
        words: state.words + 1,
        wordStartedAt: action.now,
      };
    }

    case 'confirm': {
      if (state.phase !== 'running') return state;
      // The larger of the two counts: the server's confirmations trail the
      // optimistic count by a round trip, and going backwards on a late ack
      // would make the score visibly stutter.
      return { ...state, words: Math.max(state.words, action.words) };
    }

    case 'end':
      if (state.phase === 'over') return state;
      return { ...state, phase: 'over', finishedAt: action.now };

    default:
      return state;
  }
}
