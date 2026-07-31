'use client';

import {
  useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  currentWord, initialSurvival, survivalReducer, survivalWpm,
} from '@/game/survivalReducer';
import { secondsLeft } from '@/game/heat';
import { useConfirmKey } from '@/game/useConfirmKey';
import { audio } from '@/game/audio';
import { FALLBACK_COUNTDOWN_MS, tickDelay } from '@/game/countdown';
import { track as trackEvent } from '@/game/analytics';
import type { MessageHandler } from '@/game/useDuelSocket';
import SentenceView from './SentenceView';
import HeatBar from './HeatBar';
import ArenaScene from './ArenaScene';
import SoundToggle from './SoundToggle';
import styles from './Survival.module.css';

export interface SurvivalConfig {
  script: string[];
  /** The server's own countdown. The client must not assume its own. */
  countdownMs: number | undefined;
  subscribe: (handler: MessageHandler) => () => void;
  onWord: (word: string, elapsedMs: number, accuracy: number, typos: number) => void;
  onExit: () => void;
  onAgain: () => void;
  /**
   * Another run has been asked for and the server has not armed it yet.
   *
   * A run needs a room, and a room is a round trip. Without something to show
   * for that, "Go again" is a button that swallows a click, which is precisely
   * how a player learns to press it four more times.
   */
  starting: boolean;
}

/**
 * A survival run.
 *
 * Its own screen, not a mode inside `Duel`. There is no opponent, no health, no
 * damage and no powers, and the first attempt at reusing the duel ended a run
 * with `winnerSlot: -1` because there is no winner to name. What is on screen is
 * the words, how far you have got, and a forge going cold.
 *
 * The input handling below is deliberately a close copy of the duel's rather
 * than an import, and that is a decision with a shelf life. It is the hardest
 * code in the project, it has produced three real bugs, and this repo has no DOM
 * test setup to prove a shared version behaves the same. So it gets copied once,
 * with the reasons kept, and the two unify after this has actually been played.
 */
export default function Survival({
  script, countdownMs, subscribe, onWord, onExit, onAgain, starting,
}: SurvivalConfig) {
  /**
   * Armed from the script in the initialiser rather than in an effect.
   *
   * The component is keyed on the run in `Game`, so a fresh one is a fresh
   * mount, which makes this the honest place to start. Dispatching `begin` from
   * an effect instead meant one render of an empty run, and setting state inside
   * an effect body, which is the cascading render lint rejects.
   */
  const [state, dispatch] = useReducer(
    survivalReducer,
    script,
    (from) => survivalReducer(initialSurvival(), { type: 'begin', script: from }),
  );
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  /**
   * The invisible input that exists purely to summon a phone's keyboard.
   *
   * A soft keyboard only appears for a focused, editable element, and this game
   * has none: it reads `window.keydown` and draws its own caret.
   */
  const capture = useRef<HTMLInputElement>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const track = (id: ReturnType<typeof setTimeout>) => { timers.current.push(id); return id; };

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  /**
   * Whether this device is one where the capture input is the way in.
   *
   * Through the store rather than an effect: a media query is a real external
   * source, the server has no window to ask, and setting it from inside an
   * effect is the cascading render the lint rule objects to.
   */
  const touch = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(pointer: coarse)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );

  useEffect(() => {
    trackEvent({ name: 'duel_started', mode: 'human', difficulty: 'master', touch });
    // Once per run. The component is keyed on the run, so a new one remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * When the server said it would start accepting words.
   *
   * Stamped once, on the first tick, rather than read during render — the clock
   * is impure and this is the same arrangement the duel uses for `startsAt`.
   */
  const deadline = useRef(0);

  /**
   * Countdown ticks into the run, never finishing before the server's.
   *
   * **Time remaining, not the total.** This passed the whole countdown on every
   * tick, so the three delays were the total divided by 3, then by 2, then by 1
   * — nearly twice the countdown the server had committed to, and the run sat
   * there long after it was live. That is why it felt slow: with a three second
   * deadline the client took five and a half.
   *
   * `tickDelay` was written to be given the remaining time and recompute, which
   * is exactly what the duel does with it. Only survival called it the other
   * way, and the mistake was invisible because a countdown that is too long
   * looks like a countdown.
   */
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    if (!deadline.current) {
      deadline.current = Date.now() + (countdownMs ?? FALLBACK_COUNTDOWN_MS);
    }
    const delay = tickDelay(deadline.current - Date.now(), state.countdown);
    const id = track(setTimeout(() => dispatch({ type: 'countdown' }), delay));
    return () => clearTimeout(id);
  }, [state.phase, state.countdown, countdownMs]);

  /**
   * One character, from whichever keyboard produced it.
   *
   * Shared between a physical key and a phone's soft keyboard, which arrive by
   * completely different routes. Letting each drive its own copy is how the two
   * quietly diverge.
   */
  const typeChar = useCallback((raw: string) => {
    const key = raw.toLowerCase();
    const snapshot = stateRef.current;
    if (snapshot.phase !== 'running') return;

    const expected = snapshot.sentence[snapshot.cursor];
    const correct = key === expected;

    if (!correct) {
      audio.miss();
      /**
       * The referee has to be told, and this is the only chance to tell it.
       *
       * A wrong key reaches no handler on its own: it does not advance the
       * cursor, so no word is ever committed and nothing is sent. The server was
       * left holding a room that was still `playing` for a run that had been
       * over for minutes, and since a live room is one you are still hosting,
       * every later run was refused. The player saw a Go again that did nothing
       * and a menu that did nothing, which is one bug wearing two faces.
       *
       * The word goes with it because the server matches what it owed you. It is
       * the whole word rather than the part typed: what was typed is wrong by
       * definition, and what it wanted is the thing worth naming.
       */
      onWord(currentWord(snapshot), Date.now() - snapshot.wordStartedAt, 100, 1);
      dispatch({ type: 'typed', char: key, now: Date.now() });
      return;
    }

    // The keystroke click, rising in pitch with the chain, exactly as a duel's
    // does. In survival the chain is the whole run, so it climbs the entire way.
    audio.key(snapshot.words);

    /**
     * A space commits the word, so the server gets told before the reducer has
     * moved on. Read off the snapshot for that reason: after the dispatch the
     * cursor has already rolled, possibly onto a different sentence entirely.
     */
    if (expected === ' ') {
      const start = snapshot.sentence.lastIndexOf(' ', snapshot.cursor - 1) + 1;
      const word = snapshot.sentence.slice(start, snapshot.cursor);
      const elapsed = Date.now() - snapshot.wordStartedAt;
      // Zero mistakes, always: a mistake would have ended the run rather than
      // reaching here. Sent anyway so the message shape matches the duel's.
      onWord(word, elapsed, 100, 0);
    }

    dispatch({ type: 'typed', char: key, now: Date.now() });
  }, [onWord]);

  /**
   * The soft keyboard, read through a native listener rather than React's prop.
   *
   * `onBeforeInput` looks like the obvious way and is not: React's is a
   * *synthetic* event backed by `textInput` and composition, not the native
   * `beforeinput`, and it never fired here. `beforeinput` rather than `keydown`
   * because a composing Android keyboard reports `key: 'Unidentified'` and
   * `keyCode: 229`, so the character is simply not in the key event. It is in
   * `event.data`, which is also where predictive text puts whole words, hence
   * looping rather than taking `data[0]`.
   */
  useEffect(() => {
    const input = capture.current;
    if (!input) return;

    const onBeforeInput = (e: Event) => {
      const native = e as InputEvent;
      // Always prevented: the field must stay empty, or predictive text has
      // something to autocorrect and the browser draws a second caret.
      e.preventDefault();
      for (const char of native.data ?? '') typeChar(char);
    };
    const clear = () => { input.value = ''; };

    input.addEventListener('beforeinput', onBeforeInput);
    input.addEventListener('input', clear);
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput);
      input.removeEventListener('input', clear);
    };
  }, [typeChar]);

  /** A physical keyboard. */
  useEffect(() => {
    if (state.phase !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return; }

      /**
       * Ignored while the capture input has focus.
       *
       * A physical key pressed into a focused input fires `keydown` *and* an
       * input event, so without this every character counts twice on any device
       * that has both.
       */
      if (document.activeElement === capture.current) return;

      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1) return;
      e.preventDefault();
      typeChar(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, typeChar, onExit]);

  /**
   * The forge going out, on its own, with nobody typing.
   *
   * The other half of the same bug as the typo above, and the one that made the
   * mode's second death decorative. Cold was only ever noticed when the *next*
   * word arrived, because that is the only thing that runs the server's clock.
   * A player who watched the bar reach zero and stopped — which is exactly what
   * somebody does when they can see they are dead — sat on a run that never
   * ended, in a room that stayed open, and could not start another.
   *
   * So the client keeps its own timer for the moment the bar hits nothing, and
   * sends the word it was on when it does. The server recomputes the gap from
   * timestamps it wrote itself and reaches the same verdict independently, which
   * is what stops this being a client that can declare its own runs over.
   */
  useEffect(() => {
    // Nothing is cooling until the run has begun, and it begins on the first
    // key rather than when the countdown ends — see `armed` below.
    if (state.phase !== 'running' || !state.startedAt) return;
    const left = secondsLeft(state.heat, state.words) * 1000;
    const id = track(setTimeout(() => {
      const snapshot = stateRef.current;
      if (snapshot.phase !== 'running') return;
      onWord(currentWord(snapshot), Date.now() - snapshot.wordStartedAt, 100, 0);
      audio.finishSwell(false);
      dispatch({ type: 'end', reason: 'cold', now: Date.now() });
    }, left));
    return () => clearTimeout(id);
  }, [state.phase, state.startedAt, state.heat, state.words, onWord]);

  /** The referee's word on every word, and on when the run ended. */
  useEffect(() => subscribe((message) => {
    if (message.type !== 'survivalWord') return;

    dispatch({
      type: 'confirm',
      heat: message.heat,
      cooling: message.cooling,
      words: message.wordIndex,
      appended: message.appended,
    });

    if (message.ended) {
      audio.finishSwell(false);
      dispatch({ type: 'end', reason: message.ended, now: Date.now() });
    }
  }), [subscribe]);

  const over = state.phase === 'over';

  /**
   * Space goes again, once the run is over and not before.
   *
   * `null` for the whole of a live run, which is the case that has to be right:
   * space is how a word is committed here, and a shortcut that took it would
   * end runs rather than restart them. The hook's own arming delay covers the
   * other half — the space that ended the run must not immediately start the
   * next one, and in a mode built on sudden death that keystroke is very often
   * still on its way down.
   */
  const goAgain = useMemo(
    () => (over && !starting ? onAgain : null),
    [over, starting, onAgain],
  );
  useConfirmKey(goAgain);

  return (
    /**
     * This screen *is* the plain layout, and now it says so.
     *
     * It was rendering the same `SentenceView` as a duel without claiming any
     * layout at all, so it got the arena's edge treatment: two gradients that
     * fade the line by painting `--panel` over each end. That is invisible on
     * the arena floor, which is the colour they were matched to, and here it
     * painted two lighter slabs with hard vertical edges — the words sitting on
     * a panel nobody put there.
     *
     * The default has been turned round so the masked version, which works over
     * anything, is what a screen gets for free. This attribute is no longer what
     * fixes the edges; it is here because the statement is true and any future
     * rule that distinguishes the two layouts should find survival on the right
     * side of it.
     *
     * Safe to claim wholesale. Only `SentenceView` and `HealthBar` read it
     * unscoped, everything else is nested under the duel's own screen class,
     * and there are no health plates in a run.
     */
    <main
      className={styles.screen}
      data-layout="plain"
      data-keyboard={keyboardUp || undefined}
    >
      <div className={styles.controls}>
        <SoundToggle className={styles.iconBtn} />
        <button className={styles.iconBtn} onClick={onExit} aria-label="Leave the run">✕</button>
      </div>

      <ArenaScene bare className={styles.arena}>
        <div className={styles.stream}>
          <SentenceView
            previous={state.previous}
            sentence={state.sentence}
            upcoming={state.upcoming}
            cursor={state.cursor}
            missTick={state.missTick}
            // No powers in survival: ward, surge, mend, leech and stagger are
            // all damage, and there is nobody to damage.
            powers={{}}
            wordOffset={state.wordOffset}
          />
        </div>

        <div className={styles.gauge}>
          {/* The count is the score. In sudden death, how far you got and how
              long your chain was are the same number. */}
          <span className={`${styles.count} pixel-font`} key={state.words}>{state.words}</span>
          {/* `alive` holds the bar full until the first key, matching the
              server: nothing cools before the run has begun. A bar draining
              while the player reads the opening word was showing them losing
              time they were never charged for, and it is most of why the wait
              before a run felt longer than the countdown. `startedAt` stays
              zero until they type. */}
          <HeatBar
            heat={state.heat}
            wordsSurvived={state.words}
            tick={state.heat + state.words}
            alive={!over && state.startedAt > 0}
          />
        </div>
      </ArenaScene>

      <input
        ref={capture}
        className={styles.capture}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        enterKeyHint="done"
        aria-label="Type here to survive"
        tabIndex={-1}
        onBlur={() => setKeyboardUp(false)}
      />

      {touch && !keyboardUp && !over && (
        // A real button, because iOS refuses a programmatic focus outside a
        // genuine user gesture.
        <button
          type="button"
          className={styles.tapToType}
          onClick={() => { capture.current?.focus(); setKeyboardUp(true); }}
        >
          Tap to type
        </button>
      )}

      {state.phase === 'countdown' && (
        <div className={styles.overlay}>
          <span key={state.countdown} className={`${styles.countdown} pixel-font`}>
            {state.countdown > 0 ? state.countdown : 'GO'}
          </span>
        </div>
      )}

      {over && (
        <div className={styles.overlay}>
          <div className={`panel ${styles.result}`}>
            <h1 className={`${styles.resultTitle} pixel-font`}>{state.words} words</h1>
            <p className={styles.reason}>
              {state.ended === 'typo'
                ? 'One mistake. That is the whole game.'
                : 'The forge went cold.'}
            </p>
            {/* Measured to the moment it ended, not to now. Reading the clock
                during render would make the figure creep while the result sits
                on screen, and it is also an impure call the lint rule refuses. */}
            <p className={styles.stat}>
              {survivalWpm(state, state.finishedAt)} wpm
            </p>
            {/* Disabled while it works, because a second click is a second
                room, and the label says which of the two it is doing rather
                than leaving the player to guess from a button that went
                quiet. */}
            <button
              className="btn btn-primary"
              onClick={onAgain}
              disabled={starting}
              data-working={starting || undefined}
            >
              {starting ? 'Stoking the forge' : 'Go again'}
            </button>
            <button className="btn btn-ghost" onClick={onExit}>Back</button>
            {/* Only while it does something. Mid-request there is nothing left
                to confirm, and the button already says it is working. */}
            {!starting && (
              <p className={styles.shortcut}>
                or hit <kbd className="kbd">SPACE</kbd>
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
