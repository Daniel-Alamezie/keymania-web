'use client';

import {
  useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  initialLesson, lessonAccuracy, lessonProgress, lessonReducer, lessonStars, MAX_STARS,
  type LessonState,
} from '@/game/lessonReducer';
import { useConfirmKey } from '@/game/useConfirmKey';
import { fingerLabel } from '@/game/fingers';
import { audio } from '@/game/audio';
import SentenceView from './SentenceView';
import ArenaScene from './ArenaScene';
import SoundToggle from './SoundToggle';
import RunPause from './RunPause';
import Hands from './Hands';
import styles from './Survival.module.css';
import lesson from './Lesson.module.css';
import { useVisualViewport } from '@/game/useVisualViewport';

export interface LessonConfig {
  /** The lesson's name. Shown while typing and on the card. */
  title: string;
  script: string[];
  /**
   * The finish, called exactly once. Recording the star on the path is the
   * caller's business — this screen knows how well it was typed and nothing
   * about what that unlocks.
   */
  onDone: (result: { stars: number; accuracy: number }) => void;
  onAgain: () => void;
  onExit: () => void;
  /** Where a pass leads: the next lesson, or the module's boss. */
  onNext?: () => void;
  nextLabel?: string;
}

/**
 * A lesson: a module's script, typed at whatever pace it takes.
 *
 * The third screen on Survival's shell, after the duel and the sprint, and it
 * borrows the same skeleton for the same reason — the input capture, the
 * stream and the overlays are identical work, and three copies of them drifting
 * apart would be three bugs. What it removes is the part every other mode is
 * built on.
 *
 * **No clock, and therefore no countdown, no time bar and no pause dilemma.**
 * The sprint's `RunPause` has to admit it cannot stop a server-side clock;
 * here there is nothing running at all, on this machine or any other, so
 * leaving costs only the typing already done. The gauge in the clock's place
 * fills toward the end of the script instead of draining toward zero.
 *
 * Scoring is local because a lesson is single-player against no opponent and
 * grants only a star. The moment a module awards anything competitive, this
 * has to become a refereed result — see the same note in `lessonReducer`.
 */
export default function Lesson({
  title, script, onDone, onAgain, onExit, onNext, nextLabel,
}: LessonConfig) {
  const [state, dispatch] = useReducer(
    lessonReducer,
    script,
    (from) => lessonReducer(initialLesson(), { type: 'begin', script: from }),
  );
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const capture = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useVisualViewport(screenRef, setKeyboardUp);

  const touch = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(pointer: coarse)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );

  const over = state.phase === 'done';
  const stars = over ? lessonStars(state) : 0;
  const accuracy = lessonAccuracy(state);

  /**
   * The finish, reported once.
   *
   * Guarded by a ref rather than by the effect's dependencies: `onDone` writes
   * to the path, and a caller passing a fresh closure on every render would
   * otherwise record the same lesson repeatedly.
   */
  const reported = useRef(false);
  useEffect(() => {
    if (!over || reported.current) return;
    reported.current = true;
    audio.finishSwell(true);
    onDone({ stars: lessonStars(stateRef.current), accuracy: lessonAccuracy(stateRef.current) });
  }, [over, onDone]);

  const typeChar = useCallback((raw: string) => {
    const snapshot = stateRef.current;
    if (snapshot.phase !== 'typing') return;
    if (pausedRef.current) return;

    /**
     * Lowercased to match the sprint, which means a module teaching capitals
     * cannot be scored on this screen as it stands. Modules 1 to 7 are all
     * lower case, so this holds until `capitals`; task #89 is where it has to
     * be revisited rather than discovered.
     */
    const key = raw.toLowerCase();
    const expected = snapshot.sentence[snapshot.cursor];

    if (key !== expected) {
      audio.miss();
      dispatch({ type: 'typed', char: key });
      return;
    }

    audio.key(snapshot.words);
    dispatch({ type: 'typed', char: key });
  }, []);

  /** The soft keyboard. See Survival for why beforeinput and why native. */
  useEffect(() => {
    const input = capture.current;
    if (!input) return;

    const onBeforeInput = (e: Event) => {
      const native = e as InputEvent;
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
    if (over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); setPaused((was) => !was); return; }
      if (document.activeElement === capture.current) return;
      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1) return;
      e.preventDefault();
      typeChar(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [over, typeChar]);

  const advance = useMemo(
    () => (over ? (onNext ?? onAgain) : null),
    [over, onNext, onAgain],
  );
  useConfirmKey(advance);

  const percent = Math.round(accuracy * 100);

  /** The key wanted next, and the finger that owns it. */
  const next = state.sentence[state.cursor];
  const hint = next ? fingerLabel(next) : undefined;

  return (
    <main
      ref={screenRef}
      className={styles.screen}
      data-layout="plain"
      data-keyboard={keyboardUp || undefined}
    >
      <div className={styles.controls}>
        <SoundToggle className={styles.soundSlot} />
        <button
          className={styles.iconBtn}
          onClick={() => setPaused(true)}
          aria-label="Leave the lesson"
        >
          ✕
        </button>
      </div>

      <ArenaScene bare className={styles.arena}>
        <div className={styles.stream}>
          <SentenceView
            previous={state.previous}
            sentence={state.sentence}
            upcoming={state.upcoming}
            cursor={state.cursor}
            missTick={state.missTick}
            powers={{}}
            wordOffset={state.wordOffset}
          />
        </div>

        <div className={styles.gauge}>
          {/* The lesson's name where the sprint puts its clock, and the bar
              underneath. Nothing here counts down, so nothing here is urgent:
              the only question a player has mid-lesson is how much is left. */}
          <span className={`${lesson.title} pixel-font`}>{title}</span>
          <div
            className={lesson.track}
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(lessonProgress(state) * 100)}
          >
            <div
              className={lesson.fill}
              style={{ width: `${lessonProgress(state) * 100}%` }}
            />
          </div>
          <span className={lesson.accuracy}>{percent}% accurate</span>

          {/*
            * Which finger, for the key being asked for right now.
            *
            * The reason the whole mode exists. Somebody can hunt-and-peck
            * their way through every module here, three-star the lot, and
            * have learned nothing except to hunt faster -- the letters are
            * the excuse and the finger discipline is the lesson. A browser
            * cannot see hands, so this cannot be enforced; it can only be
            * kept in front of somebody continuously, which is what this is.
            *
            * It updates per keystroke rather than per word on purpose. A
            * hint that only appears when you are stuck is a hint you consult
            * after already having reached with the wrong finger.
            */}
          {/*
            * The hands, and the words underneath them.
            *
            * Both, because they answer at different speeds: the diagram is
            * read at a glance and the sentence is what somebody falls back on
            * when the diagram has not clicked yet. The picture leads.
            */}
          {!over && <Hands next={next} />}

          {!over && next && (
            <span className={lesson.finger}>
              <kbd className={`${lesson.nextKey} pixel-font`}>
                {next === ' ' ? 'space' : next}
              </kbd>
              {hint && <span className={lesson.hand}>{hint}</span>}
            </span>
          )}
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
        aria-label="Type here to practise"
        tabIndex={-1}
        onBlur={() => setKeyboardUp(false)}
      />

      {touch && !keyboardUp && !over && (
        <button
          type="button"
          className={styles.tapToType}
          onClick={() => { capture.current?.focus(); setKeyboardUp(true); }}
        >
          Tap to type
        </button>
      )}

      {paused && !over && (
        <RunPause
          /* The sprint has to warn that its clock is still running. A lesson
             has no clock to leave running, and saying so is the reassurance
             rather than the caveat. */
          warning="Nothing is timed here. Leaving only loses the typing you have done in this lesson."
          onResume={() => setPaused(false)}
          onRestart={() => { setPaused(false); onAgain(); }}
          onExit={() => { setPaused(false); onExit(); }}
          restarting={false}
        />
      )}

      {over && (
        <div className={styles.overlay}>
          <div className={`panel ${styles.result}`}>
            {/* No "Scoring…" step, unlike the sprint. There is no referee to
                wait for, so inventing a pause would be theatre. */}
            <h1 className={`${styles.resultTitle} pixel-font`}>Lesson complete</h1>

            <div className={lesson.stars} aria-label={`${stars} out of ${MAX_STARS} stars`}>
              {Array.from({ length: MAX_STARS }, (_, i) => (
                <span
                  key={i}
                  className={lesson.star}
                  data-earned={i < stars || undefined}
                  aria-hidden="true"
                >
                  ★
                </span>
              ))}
            </div>

            <p className={styles.reason}>
              {percent}% accurate.
              {stars < MAX_STARS && ' Come back for the rest whenever you like — stars only go up.'}
            </p>

            {onNext && nextLabel && (
              <p className={`${lesson.nextUp} pixel-font`}>{nextLabel}</p>
            )}

            {onNext ? (
              <button className="btn btn-primary" onClick={onNext}>Continue</button>
            ) : (
              <button className="btn btn-primary" onClick={onAgain}>Again</button>
            )}
            {onNext && (
              <button className="btn btn-ghost" onClick={onAgain}>Again</button>
            )}
            <button className="btn btn-ghost" onClick={onExit}>Back to the path</button>
            <p className={styles.shortcut}>
              or hit <kbd className="kbd">SPACE</kbd>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export type { LessonState };
