/**
 * The warm-up, as the client sees it.
 *
 * Every other mode in this game has something at stake. The duel has an
 * opponent, the sprint has thirty seconds, Survival ends on a single slip, and
 * even a lesson has a finish line to reach. This has none of them, and that
 * absence is the whole design: it exists for the minute before you are ready to
 * be measured, and for the beginner who is not ready to be measured at all.
 *
 * Three things are missing on purpose, and each is a difference from
 * `weeklyReducer` rather than an omission:
 *
 *  - **No clock.** Nothing counts down and nothing counts up. A timer is the
 *    thing that turns typing into performing, and performing is what somebody
 *    warming up is trying to postpone.
 *  - **No health, and no end.** A typo costs the streak and nothing else. The
 *    words keep coming until the player leaves, so there is no phase to model:
 *    the mode is over when the screen unmounts, which is navigation rather than
 *    state.
 *  - **No wpm, anywhere.** Not on screen and not in the summary. A speed shown
 *    is a speed being judged, and this mode's claim is that nothing here is.
 *
 * **The streak is not the combo.** The arena's combo is explicitly about
 * chaining words *fast* — it is a speed mechanic wearing a counter. Take the
 * time pressure away and it has nothing left to measure. So this counts
 * something else with the same word: consecutive clean words. The rule is one a
 * player can hold in their head without being told twice.
 *
 *   Every clean word adds one. Any typo puts you back to zero.
 *
 * A word you mistyped inside does not count, even if you then fix it — the
 * streak is a record of not slipping, and you slipped. It starts again from the
 * next word, which is the encouraging half of the same rule.
 *
 * **Nothing here is recorded against duelling.** See `saveResult`: a figure
 * earned with no clock and no opponent is not comparable to one earned under
 * both, and `bestSpeed` feeds the bot unlock ladder, so a warm-up leaking into
 * it would silently open Champion. The only thing that survives the session is
 * the best streak, kept locally, which is a fact about this mode alone.
 */

export interface WarmupState {
  /* The stream, shaped exactly as SentenceView wants it. */
  previous: string;
  sentence: string;
  upcoming: string;
  cursor: number;
  wordOffset: number;
  missTick: number;

  /**
   * Lines waiting behind `upcoming`.
   *
   * The reducer stays pure, so it cannot draw its own sentences: the screen
   * feeds it. A buffer rather than one-at-a-time because a line arriving
   * exactly as the previous one finishes would blank the next-line preview for
   * a frame, and the preview is what lets somebody read ahead.
   */
  queue: string[];

  /** Words committed. The only tally that is simply a count of work done. */
  words: number;
  /** Keys struck correctly, and keys struck that were not the one wanted. */
  hits: number;
  misses: number;

  /** Clean words in a row, right now. */
  streak: number;
  /** The longest this session reached. What the summary is about. */
  best: number;
  /**
   * Whether the word under the cursor has been typed cleanly so far.
   *
   * Without this, a word with a typo in the middle would still add one on
   * commit, because the miss had already zeroed the streak and the commit only
   * ever increments. The counter would climb through mistakes, which is the
   * one thing it must not do.
   */
  wordClean: boolean;
}

/**
 * There is no action for finishing, deliberately. Nothing finishes. Leaving is
 * navigation, and modelling it here would invite a caller to score a session
 * that was never a test.
 */
export type WarmupAction =
  | { type: 'begin'; lines: string[] }
  /** One more line for the buffer, drawn by the screen. */
  | { type: 'feed'; line: string }
  | { type: 'typed'; char: string };

const withSpace = (sentence: string) => `${sentence} `;

export function initialWarmup(): WarmupState {
  return {
    previous: '',
    sentence: '',
    upcoming: '',
    cursor: 0,
    wordOffset: 0,
    missTick: 0,
    queue: [],
    words: 0,
    hits: 0,
    misses: 0,
    streak: 0,
    best: 0,
    wordClean: true,
  };
}

/** The word under the cursor, for the same per-word reporting every mode does. */
export function currentWarmupWord(state: WarmupState): string {
  const start = state.sentence.lastIndexOf(' ', state.cursor - 1) + 1;
  const end = state.sentence.indexOf(' ', state.cursor);
  return state.sentence.slice(start, end === -1 ? undefined : end);
}

/**
 * The share of keystrokes that were the right one, from 0 to 1.
 *
 * An untouched session is 1 rather than 0, as in a lesson: nobody has made a
 * mistake yet, and opening on 0% would be both false and discouraging in the
 * same breath.
 */
export function warmupAccuracy(state: WarmupState): number {
  const struck = state.hits + state.misses;
  return struck === 0 ? 1 : state.hits / struck;
}

export function warmupReducer(state: WarmupState, action: WarmupAction): WarmupState {
  switch (action.type) {
    case 'begin': {
      const lines = action.lines.filter((line) => line.trim() !== '');
      if (lines.length === 0) return initialWarmup();
      return {
        ...initialWarmup(),
        sentence: withSpace(lines[0]),
        upcoming: lines[1] ? withSpace(lines[1]) : '',
        queue: lines.slice(2),
      };
    }

    case 'feed':
      return action.line.trim() === ''
        ? state
        : { ...state, queue: [...state.queue, action.line] };

    case 'typed': {
      const expected = state.sentence[state.cursor];
      if (expected === undefined) return state;

      /**
       * Wrong key: the streak falls, the line flinches, and the cursor stays
       * exactly where it is. That is the entire cost. No seconds lost as in the
       * sprint, no run ended as in Survival — the letter still has to be found,
       * and finding it is the practice.
       */
      if (action.char !== expected) {
        return {
          ...state,
          misses: state.misses + 1,
          missTick: state.missTick + 1,
          streak: 0,
          wordClean: false,
        };
      }

      const advanced = state.cursor + 1;
      const hits = state.hits + 1;

      if (expected !== ' ') return { ...state, cursor: advanced, hits };

      /* A space commits the word. Clean words climb; a word that was mistyped
         inside leaves the streak on the floor its typo put it on. */
      const streak = state.wordClean ? state.streak + 1 : 0;
      const committed = {
        hits,
        words: state.words + 1,
        streak,
        best: Math.max(state.best, streak),
        wordClean: true,
      };

      if (advanced < state.sentence.length) {
        return { ...state, ...committed, cursor: advanced };
      }

      /**
       * Off the end of the line, which is a wrap rather than a finish.
       *
       * The fallback repeats the line just typed if the buffer has run dry.
       * That should not happen — the screen feeds on every commit — but an
       * endless mode that can reach an empty sentence is an endless mode that
       * can stop dead, and one repeated line is a far cheaper failure than a
       * screen nobody can type on.
       */
      const nextLine = state.upcoming || state.sentence;
      return {
        ...state,
        ...committed,
        previous: state.sentence,
        sentence: nextLine,
        upcoming: state.queue[0] ? withSpace(state.queue[0]) : '',
        queue: state.queue.slice(1),
        wordOffset: state.wordOffset + state.sentence.trim().split(' ').length,
        cursor: 0,
      };
    }

    default:
      return state;
  }
}
