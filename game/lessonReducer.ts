/**
 * A lesson, as the client sees it.
 *
 * The weekly sprint's sibling in machinery and its opposite in intent. It
 * reuses the same stream shape and the same word-completion path, and takes
 * out the one thing every other mode in this game is built around: the clock.
 *
 * **There is no timer, and that is the whole design.** A clock on somebody's
 * first touch-typing lesson teaches panic, and panic is the precise habit a
 * beginner must not learn — it is what produces a typist who looks at the
 * keyboard, hunts, and never gets past thirty words a minute. Speed is not
 * skipped, it is deferred: it belongs in the boss at the end of the module,
 * where it has been earned. Here the only things that count are finishing and
 * how cleanly it was done.
 *
 * Three consequences follow from having no clock, and each of them is a
 * difference from `weeklyReducer` rather than an oversight:
 *
 *  - **No countdown.** Three-two-one exists to start a race fairly. Nothing is
 *    being raced, so the lesson is simply ready, and it begins whenever the
 *    player begins.
 *  - **The script is finite and never wraps.** The sprint loops its bank
 *    because thirty seconds must always have a next word; a lesson is a fixed
 *    amount of work, and running out of it is the goal rather than an edge
 *    case.
 *  - **A wrong key does not advance.** The right key has to be pressed before
 *    the cursor moves. That is the tutor's rule and not the game's: the point
 *    of the exercise is the association between a letter and a finger, and
 *    letting a miss slide past would teach the wrong finger just as firmly as
 *    the right one teaches the right one.
 *
 * Nothing here is refereed. A lesson is single-player against no opponent and
 * awards only a star on the path, so the client scores it and the server
 * records what it is told — see the note on `path.ts` in keymania-api. That
 * stays acceptable exactly as long as a module grants nothing competitive.
 */

/** The best a lesson can be passed at. Mirrors `MAX_STARS` in the API. */
export const MAX_STARS = 3;

/**
 * What each star costs, as a share of keystrokes struck correctly.
 *
 * The first star is finishing, and it is deliberately free of any accuracy
 * bar. Advancing along the path needs one star, so anything gating that first
 * star on precision would wall off exactly the people the path was built for —
 * somebody typing at fifteen words a minute with clumsy hands has to be able to
 * walk the whole thing. Mastery is what the second and third stars are for, and
 * since stars only ever climb, a player can come back for them at no risk.
 */
export const STAR_ACCURACY = [0, 0.95, 0.98] as const;

export interface LessonState {
  /** Ready from the first render; there is nothing to wait for. */
  phase: 'typing' | 'done';

  /* The stream, shaped exactly as SentenceView wants it. */
  previous: string;
  sentence: string;
  upcoming: string;
  cursor: number;
  wordOffset: number;
  missTick: number;

  /** The lesson's lines, in order. Finite, and never wrapped. */
  script: string[];
  scriptIndex: number;

  /** Keys struck correctly. Equal to the characters of script completed. */
  hits: number;
  /** Keys struck that were not the one wanted. */
  misses: number;
  words: number;
}

/**
 * There is no action for leaving early, deliberately. Abandoning a lesson is
 * navigation: the screen unmounts and the state goes with it. Modelling it as
 * a phase would invite a caller to score an abandoned run, and the only honest
 * score for one is the absence of a write.
 */
export type LessonAction =
  | { type: 'begin'; script: string[] }
  | { type: 'typed'; char: string };

const withSpace = (sentence: string) => `${sentence} `;

export function initialLesson(): LessonState {
  return {
    phase: 'typing',
    previous: '',
    sentence: '',
    upcoming: '',
    cursor: 0,
    wordOffset: 0,
    missTick: 0,
    script: [],
    scriptIndex: 0,
    hits: 0,
    misses: 0,
    words: 0,
  };
}

/** The word under the cursor, for the same per-word reporting the sprint does. */
export function currentLessonWord(state: LessonState): string {
  const start = state.sentence.lastIndexOf(' ', state.cursor - 1) + 1;
  const end = state.sentence.indexOf(' ', state.cursor);
  return state.sentence.slice(start, end === -1 ? undefined : end);
}

/**
 * How far through the lesson, from 0 to 1.
 *
 * This is the figure the screen puts in the place the sprint puts its clock,
 * and the swap is the mode in one gauge. A countdown says *hurry*; a bar
 * filling toward a fixed end says *this finishes, and you are getting there* —
 * which is the only encouragement that works on somebody slow enough to need
 * the lesson in the first place.
 */
export function lessonProgress(state: LessonState): number {
  if (state.phase === 'done') return 1;
  // Every line is typed with the trailing space the stream adds to it.
  const total = state.script.reduce((sum, line) => sum + line.length + 1, 0);
  return total === 0 ? 1 : Math.min(1, state.hits / total);
}

/**
 * The share of keystrokes that were the right one, from 0 to 1.
 *
 * An untouched lesson is 1 rather than 0. Nobody has made a mistake yet, and
 * showing a beginner 0% accuracy before they have pressed a key would be both
 * false and discouraging in the same breath.
 */
export function lessonAccuracy(state: LessonState): number {
  const struck = state.hits + state.misses;
  return struck === 0 ? 1 : state.hits / struck;
}

/**
 * What a lesson was passed at: 0 if it was not finished, otherwise 1 to 3.
 *
 * Unfinished is unambiguously zero. Leaving a lesson part-way is not a partial
 * pass, because the module's job is to cover every key it teaches and half of
 * those keys are in the half that was skipped.
 */
export function lessonStars(state: LessonState): number {
  if (state.phase !== 'done') return 0;
  const accuracy = lessonAccuracy(state);
  let stars = 0;
  for (const needed of STAR_ACCURACY) if (accuracy >= needed) stars += 1;
  return Math.min(MAX_STARS, stars);
}

export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  switch (action.type) {
    case 'begin': {
      const script = action.script.filter((line) => line.trim() !== '');
      // An empty lesson is done on arrival rather than a screen that cannot be
      // typed on. It should not survive authoring, but a curriculum edited as
      // often as this one will be should not be able to produce a dead screen.
      if (script.length === 0) return { ...initialLesson(), phase: 'done' };
      return {
        ...initialLesson(),
        script,
        sentence: withSpace(script[0]),
        upcoming: script[1] ? withSpace(script[1]) : '',
      };
    }

    case 'typed': {
      if (state.phase !== 'typing') return state;

      const expected = state.sentence[state.cursor];
      if (expected === undefined) return state;

      /**
       * Wrong key: count it, shake the line, and stay exactly where you are.
       * No death as in Survival, no lost seconds as in the sprint — the cost
       * is that the letter still has to be found, which is the lesson.
       */
      if (action.char !== expected) {
        return { ...state, misses: state.misses + 1, missTick: state.missTick + 1 };
      }

      const advanced = state.cursor + 1;
      const hits = state.hits + 1;

      if (expected !== ' ') {
        return { ...state, cursor: advanced, hits };
      }

      const lineDone = advanced >= state.sentence.length;
      const wordsInLine = state.sentence.trim().split(' ').length;

      if (!lineDone) {
        return { ...state, cursor: advanced, hits, words: state.words + 1 };
      }

      const nextIndex = state.scriptIndex + 1;

      /** Off the end of the script is the finish, not a wrap. */
      if (nextIndex >= state.script.length) {
        return {
          ...state,
          phase: 'done',
          cursor: advanced,
          hits,
          words: state.words + 1,
        };
      }

      return {
        ...state,
        previous: state.sentence,
        sentence: withSpace(state.script[nextIndex]),
        upcoming: state.script[nextIndex + 1] ? withSpace(state.script[nextIndex + 1]) : '',
        scriptIndex: nextIndex,
        wordOffset: state.wordOffset + wordsInLine,
        cursor: 0,
        hits,
        words: state.words + 1,
      };
    }

    default:
      return state;
  }
}
