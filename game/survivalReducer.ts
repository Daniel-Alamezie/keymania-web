import { CAPACITY_MS } from './heat';
import { seekTo } from './resync';
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
  /**
   * The last count the referee actually acknowledged.
   *
   * `words` runs ahead of this by design — the screen predicts and is
   * corrected. The distance between them is the only way this client can tell
   * a fast connection from a dead one, because nothing else about a dropped
   * socket is visible from here. See `MAX_UNCONFIRMED`.
   */
  confirmed: number;
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
  | { type: 'end'; reason: SurvivalEnd; now: number }
  /** The referee's own script and position, after a desync. */
  | { type: 'resync'; script: string[]; wordIndex: number };

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
    confirmed: 0,
    heat: CAPACITY_MS,
    cooling: 1,
    charsTyped: 0,
    startedAt: 0,
    wordStartedAt: 0,
    finishedAt: 0,
    ended: null,
  };
}

/**
 * Nothing left to type, because the script ran out from under the run.
 *
 * A line with no letters on it is not a hard state to be in, it is an
 * impossible one: every sentence the server generates has words. So this only
 * ever means the client walked past the end of the script it holds, which
 * happens when the top-ups the server sends stop arriving mid-run.
 *
 * Derived rather than stored, so it cannot fall out of step with the line
 * actually on screen the way a second flag would.
 */
export const isStarving = (state: SurvivalState): boolean =>
  state.phase === 'running' && state.sentence.trim() === '';

/**
 * How far ahead of the referee this client will get before it stops.
 *
 * There was no limit, and that is the whole of the bug three players reported.
 * The screen advances on every keystroke and the server confirms behind it,
 * which is right — a run that waited for a round trip per word would feel
 * broken at any real speed. What was missing is a ceiling on the *gap*.
 *
 * With none, a socket that drops mid-run is invisible: the client keeps
 * accepting words against the script it already holds, sixty of them if it has
 * that many, and only discovers the referee stopped answering when it runs off
 * the end. By then the correction is enormous, and a correction that large
 * does not read as a correction. It reads as being thrown back to the start of
 * the run, because that is what it looks like.
 *
 * Twelve is chosen from both sides. Above: a player at 150 wpm sends about two
 * and a half words a second, so twelve unanswered words is nearly five seconds
 * of silence, far past any ordinary burst of jitter or a slow round trip.
 * Below: the server keeps forty words of script ahead of where it thinks the
 * player is, so stopping at twelve means the stall always happens with script
 * to spare rather than at the end of it. The old failure needed both of those
 * to be true at once and neither was.
 *
 * Derived, not stored, for the reason `isStarving` is: a flag set beside the
 * two counts is a third thing that can disagree with them.
 */
export const MAX_UNCONFIRMED = 12;

/**
 * Waiting for the referee to catch up.
 *
 * The run is not over and nothing is wrong with what the player typed. The
 * screen simply refuses to get any further ahead until it hears back, so the
 * correction when it comes is a nudge rather than a different run.
 */
export const isStalled = (state: SurvivalState): boolean =>
  state.phase === 'running' && state.words - state.confirmed >= MAX_UNCONFIRMED;

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

      /**
       * A line with no words in it accepts nothing.
       *
       * This is the state a run lands in when it reaches the end of the script
       * before the server's next sentence arrives: `withSpace(undefined ?? '')`
       * is `' '`, one character long and that character a space. Left accepting
       * input, the only key that did anything was the spacebar, every press
       * committed an empty word and consumed another script slot, and a player
       * holding the game alive was outrunning the top-up that would have saved
       * them. Somebody reported exactly that at 68 words.
       *
       * Ignoring the key is what makes it recoverable. Nothing is counted,
       * nothing is consumed, and `confirm` fills the line in as soon as a
       * sentence lands — which is within a round trip, because committing the
       * word that emptied the stream is itself what asks for the next one.
       */
      if (state.sentence.trim() === '') return state;

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
       *
       * **Unless the referee has gone quiet.** Prediction is only worth having
       * while there is something correcting it; past `MAX_UNCONFIRMED` this is
       * not predicting any more, it is inventing a run nobody is refereeing.
       * The word is held here rather than committed, so the screen waits at a
       * word boundary the server can still be talked to about — and the
       * keystroke is not a mistake, so nothing flinches and nothing is scored.
       *
       * Checked before the count moves, so the ceiling is a ceiling: the gap
       * can reach twelve and stop, never thirteen.
       */
      if (isStalled(state)) return state;

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
    case 'confirm': {
      if (state.phase === 'over') return state;
      const grown = action.appended ? [...state.script, action.appended] : state.script;
      return {
        ...state,
        heat: orKeep(action.heat, state.heat),
        cooling: orKeep(action.cooling, state.cooling),
        words: orKeep(action.words, state.words),
        /**
         * The referee has spoken, so the gap closes by exactly this much.
         *
         * Taken from the same number `words` adopts, never incremented
         * locally: the point of this field is that it is the server's opinion
         * and nothing else. A locally bumped copy would drift into agreeing
         * with the optimistic count, and a ceiling measured against a number
         * that follows the thing it is limiting is not a ceiling.
         */
        confirmed: orKeep(action.words, state.confirmed),
        script: grown,
        /**
         * Adopt a sentence that arrived while the stream was waiting on it.
         *
         * The old version repaired `upcoming` and left `sentence` alone, which
         * meant a run already stranded on an empty line stayed stranded for
         * ever: the only thing that could have fixed it was the very message
         * that chose not to.
         *
         * Both are patched now, and from the grown script rather than from
         * `appended` directly, so it does not matter whether the sentence that
         * unblocks this is the one that just arrived or one that was already
         * sitting there unread.
         */
        sentence: state.sentence.trim() === ''
          ? withSpace(grown[state.scriptIndex] ?? '')
          : state.sentence,
        upcoming: state.upcoming.trim() === ''
          ? withSpace(grown[state.scriptIndex + 1] ?? '')
          : state.upcoming,
      };
    }

    case 'resync': {
      /**
       * Take the referee's script and stand where it says.
       *
       * Both halves matter. The index alone would leave a client that had
       * missed an appended sentence reading different words from the server
       * at the same position — still refused, still stuck. Replacing the
       * script makes the two identical before the seek decides where in it
       * to stand.
       *
       * The count is adopted too, because it is the number the record and the
       * board will use; the local one was optimistic and is now known wrong.
       * Nothing else about the run is touched: the forge keeps its heat, and a
       * cursor correction must never read as damage.
       */
      if (state.phase === 'over') return state;
      const seek = seekTo(action.script, action.wordIndex);
      return {
        ...state,
        script: action.script,
        scriptIndex: seek.scriptIndex,
        sentence: seek.sentence,
        upcoming: seek.upcoming,
        cursor: seek.cursor,
        words: action.wordIndex,
        /* A resync is the referee's position by definition, so the gap is
           zero the moment it lands. Left stale, the run would resume already
           at its ceiling and stall on the next word. */
        confirmed: action.wordIndex,
        // Words before the sentence now on screen, recomputed rather than
        // carried: it is what SentenceView measures its highlighting from,
        // and a stale one after a seek points at the wrong words.
        wordOffset: action.script
          .slice(0, seek.scriptIndex)
          .reduce((sum, sentence) => sum + sentence.split(' ').length, 0),
      };
    }

    case 'end':
      if (state.phase === 'over') return state;
      return { ...state, phase: 'over', ended: action.reason, finishedAt: action.now, heat: 0 };

    default:
      return state;
  }
}

/**
 * The word the cursor is standing in, whole.
 *
 * Not the part already typed — the whole word, because the only thing that reads
 * it is the referee, and the referee is comparing against the word it owed you.
 * Used when a run ends mid-word, which is every run that ends on a typo.
 */
export function currentWord(state: SurvivalState): string {
  const start = state.sentence.lastIndexOf(' ', Math.max(0, state.cursor - 1)) + 1;
  const end = state.sentence.indexOf(' ', state.cursor);
  return state.sentence.slice(start, end < 0 ? undefined : end);
}

/** Words per minute across the whole run, on the standard five-character word. */
export function survivalWpm(state: SurvivalState, now: number): number {
  const elapsed = now - state.startedAt;
  if (elapsed <= 0 || state.charsTyped === 0) return 0;
  return Math.round(state.charsTyped / 5 / (elapsed / 60_000));
}
