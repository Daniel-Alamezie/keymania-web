'use client';

import {
  useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  initialWarmup, warmupAccuracy, warmupReducer,
} from '@/game/warmupReducer';
import { bestServerSnapshot, bestSnapshot, recordStreak, subscribeBest } from '@/game/warmupBest';
import { randomSentence } from '@/game/sentences';
import { fingerFor, fingerLabel } from '@/game/fingers';
import { DEFAULT_LAYOUT, type LayoutId } from '@/game/keyboard';
import { audio } from '@/game/audio';
import { track } from '@/game/analytics';
import SentenceView from './SentenceView';
import ArenaScene from './ArenaScene';
import ArenaControls from './ArenaControls';
import Hands from './Hands';
import RetroKeyboard from './RetroKeyboard';
import styles from './Survival.module.css';
import lesson from './Lesson.module.css';
import warm from './Warmup.module.css';
import { useVisualViewport } from '@/game/useVisualViewport';

/** Enough lines to open on, and to stay ahead of the fastest reader. */
const SEED_LINES = 4;

/**
 * The warm-up: words that never stop, and nothing at stake.
 *
 * Survival's shell again, like the lesson and the sprint, because the input
 * capture, the stream and the soft keyboard are identical work and three copies
 * of them drifting apart would be three bugs. What is different is everything
 * the shell usually holds.
 *
 * **There is no phase.** No countdown to sit through, no clock to run out, no
 * health to lose and no end to reach. That is not a simplification of the other
 * modes, it is the mode: this exists for the minute before somebody is ready to
 * be measured, and for the beginner who is not ready to be measured at all. A
 * screen with nothing to lose is the only place a nervous typist will slow down
 * enough to use the right finger.
 *
 * **The gauge shows a streak where every other mode shows a threat.** Survival
 * puts a cooling forge there, the sprint a countdown, a lesson a bar filling
 * toward its end. Here the number goes up while you are doing well and resets
 * when you slip, and the reset costs nothing but the number. See
 * `warmupReducer` for why this is a different quantity from the arena's combo
 * despite wearing the same word.
 *
 * **No speed is shown, anywhere.** Not live, not in the summary. A speed on
 * screen is a speed being judged, and the claim this mode makes is that nothing
 * here is. It is also what keeps the mode honest about its own figures: see
 * `warmupBest` for why the streak is the only thing that survives the session.
 */
export default function Warmup(
  { onExit, layout = DEFAULT_LAYOUT }: { onExit: () => void; layout?: LayoutId },
) {
  const [state, dispatch] = useReducer(
    warmupReducer,
    null,
    () => warmupReducer(initialWarmup(), {
      type: 'begin',
      lines: Array.from({ length: SEED_LINES }, () => randomSentence()),
    }),
  );
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const capture = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useVisualViewport(screenRef, setKeyboardUp);

  /** Showing the session back to somebody who asked to stop. */
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  useEffect(() => { leavingRef.current = leaving; }, [leaving]);

  /*
   * What there was to beat when this session opened.
   *
   * Captured once, because the store is updated as the session runs and would
   * otherwise always match the number being chased. State rather than a ref:
   * this is read while rendering, and a ref read during render is the thing
   * that tears under concurrent rendering.
   */
  const [toBeat] = useState(() => bestSnapshot());
  useSyncExternalStore(subscribeBest, bestSnapshot, bestServerSnapshot);

  const touch = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(pointer: coarse)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );

  useEffect(() => { track({ name: 'warmup_started' }); }, []);

  /**
   * Keep the best as it happens, rather than on the way out.
   *
   * A session ended by closing the tab is the common one, and it is exactly the
   * session that would lose its streak if this waited for a button.
   */
  useEffect(() => { recordStreak(state.best); }, [state.best]);

  /**
   * Stay ahead of the reader.
   *
   * Fed per committed word rather than per line, so the buffer is topped up
   * long before it is needed. The reducer keeps a floor under this anyway, but
   * a floor that repeats a line is a worse experience than never reaching it.
   */
  useEffect(() => {
    if (state.queue.length >= 2) return;
    dispatch({ type: 'feed', line: randomSentence(state.sentence) });
  }, [state.words, state.queue.length, state.sentence]);

  const typeChar = useCallback((raw: string) => {
    if (leavingRef.current) return;
    const snapshot = stateRef.current;
    const expected = snapshot.sentence[snapshot.cursor];
    if (expected === undefined) return;

    /* Case is never the point here, so it is never enforced. Somebody warming
       up with caps lock on is warming up, not failing. */
    const key = raw.toLowerCase();

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
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); setLeaving((was) => !was); return; }
      if (document.activeElement === capture.current) return;
      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1) return;
      e.preventDefault();
      typeChar(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typeChar]);

  const leave = useCallback(() => {
    track({
      name: 'warmup_finished',
      words: stateRef.current.words,
      best_streak: stateRef.current.best,
      accuracy: Math.round(warmupAccuracy(stateRef.current) * 100),
    });
    onExit();
  }, [onExit]);

  const percent = Math.round(warmupAccuracy(state) * 100);
  const next = state.sentence[state.cursor];
  const hint = next ? fingerLabel(next, layout) : undefined;
  const owner = next ? fingerFor(next) : undefined;
  const reachFrom = owner && next && next !== ' ' && owner.home !== next
    ? owner.home
    : undefined;

  return (
    <main
      ref={screenRef}
      className={styles.screen}
      data-layout="plain"
      data-keyboard={keyboardUp || undefined}
    >
      <ArenaControls
        className={styles.controls}
        onLeave={() => setLeaving(true)}
        leaveLabel="Stop warming up"
      />

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
          {/*
            * The streak where the sprint puts its clock.
            *
            * A countdown says hurry. A number that climbs while you are doing
            * well and costs nothing when it falls says keep going, which is the
            * only encouragement that works on somebody who came here because
            * the timed modes were too much.
            */}
          <span className={`${warm.streak} pixel-font`} data-live={state.streak > 0 || undefined}>
            {state.streak}
          </span>
          <span className={warm.streakLabel}>
            {state.streak === 1 ? 'word in a row' : 'words in a row'}
          </span>

          <span className={warm.line}>
            {/* The session's own best first, because it is the one being
                chased right now. The stored one is context. */}
            best this session {state.best}
            {toBeat > 0 && ` · to beat ${toBeat}`}
            {' · '}
            {percent}% accurate
          </span>

          {/*
            * The full board on a desktop, the compact hands on touch.
            *
            * Not the same swap the lesson made, because this screen goes where
            * the path does not: the warm-up is reachable on a phone, and a
            * drawn keyboard above a soft keyboard is two keyboards on one
            * small screen, each half covering the other. The schematic pair
            * earns its keep there; everywhere else the board says strictly
            * more.
            */}
          {touch
            ? <Hands next={next} />
            : <RetroKeyboard next={next} width={560} layout={layout} />}

          {next && (
            <span className={lesson.finger}>
              <kbd className={`${lesson.nextKey} pixel-font`}>
                {next === ' ' ? 'space' : next}
              </kbd>
              {hint && (
                <span className={lesson.hand}>
                  {hint}
                  {reachFrom && `, reaching from ${reachFrom}`}
                </span>
              )}
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
        aria-label="Type here to warm up"
        tabIndex={-1}
        onBlur={() => setKeyboardUp(false)}
      />

      {touch && !keyboardUp && !leaving && (
        <button
          type="button"
          className={styles.tapToType}
          onClick={() => { capture.current?.focus(); setKeyboardUp(true); }}
        >
          Tap to type
        </button>
      )}

      {/*
        * The way out, and the only summary there is.
        *
        * Not `RunPause`: that screen exists to warn that a clock is still
        * running, and there is no clock here to warn about. What somebody
        * leaving actually wants is to see what they just did, which nothing
        * else in this mode ever tells them.
        */}
      {leaving && (
        <div className={warm.card} role="dialog" aria-label="Warm-up so far">
          <h2 className={`${warm.cardTitle} pixel-font`}>Warmed up</h2>

          <dl className={warm.stats}>
            <div>
              <dt>Words</dt>
              <dd className="pixel-font">{state.words}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd className="pixel-font">{state.best}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd className="pixel-font">{percent}%</dd>
            </div>
          </dl>

          {state.best > toBeat && toBeat > 0 && (
            <p className={warm.record}>
              A new best. The last one was {toBeat}.
            </p>
          )}

          <div className={warm.actions}>
            <button className="btn btn-primary" onClick={() => setLeaving(false)}>
              Keep typing
            </button>
            <button className="btn btn-ghost" onClick={leave}>
              Done for now
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
