'use client';

import {
  useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  initialWarmup, warmupAccuracy, warmupReducer,
} from '@/game/warmupReducer';
import {
  bestAt, DEFAULT_SECONDS, recordTest, subscribeTests, TEST_SECONDS,
  testAccuracy, testsServerSnapshot, testsSnapshot, testWpm, type TestSeconds,
} from '@/game/typingTest';
import { randomSentence } from '@/game/sentences';
import { DEFAULT_LAYOUT, type LayoutId } from '@/game/keyboard';
import { audio } from '@/game/audio';
import { track } from '@/game/analytics';
import SentenceView from './SentenceView';
import ArenaScene from './ArenaScene';
import ArenaControls from './ArenaControls';
import styles from './Survival.module.css';
import warm from './Warmup.module.css';
import test from './TypingTest.module.css';
import { useVisualViewport } from '@/game/useVisualViewport';

/** Enough lines to open on, and to stay ahead of the fastest reader. */
const SEED_LINES = 4;

/** How often the clock is re-read. Fast enough that the last second is not a lie. */
const TICK_MS = 100;

/**
 * The typing test: pick a length, type until it runs out, get a number.
 *
 * Survival's shell again, and `warmupReducer` for the stream, because "endless
 * words where a typo costs you nothing but the streak" is exactly the mechanic
 * this wants and it already exists, tested. What this adds is the one thing
 * the warm-up refuses on principle: a clock, and a speed at the end of it.
 *
 * The two modes are neighbours rather than duplicates. The warm-up is for
 * before you are ready to be measured; this is for when you want the number.
 * Keeping them apart is what lets the warm-up go on promising that nothing on
 * it is being judged.
 *
 * **The clock starts on the first keystroke, not on a countdown.** Every other
 * timed thing in this game counts you in, because a duel has an opponent who
 * must start at the same instant and a sprint is a shared board where a head
 * start would be worth something. Neither is true here: there is nobody to be
 * fair to, so a countdown would only be three seconds of somebody staring at a
 * number instead of typing. Waiting for the first letter also means a player
 * who looks away, or whose phone raises its keyboard slowly, loses nothing.
 *
 * **Nothing here is reported anywhere.** No result call, no duel record, and
 * above all nothing near `bestSpeed`, which feeds the bot ladder. See the note
 * at the top of `game/typingTest.ts`: a speed is exactly the quantity that
 * would do damage if it leaked, and this is the mode that produces one.
 */
export default function TypingTest(
  { onExit, layout = DEFAULT_LAYOUT }: { onExit: () => void; layout?: LayoutId },
) {
  void layout;

  /**
   * `ready` is the screen with the words already up and the clock full, which
   * is why there is no separate "start" phase: the test begins when a letter
   * arrives, so the ready screen and the running one are the same screen with
   * a stopped clock.
   */
  const [phase, setPhase] = useState<'choosing' | 'ready' | 'running' | 'done'>('choosing');
  const [seconds, setSeconds] = useState<TestSeconds>(DEFAULT_SECONDS);

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

  /* The clock. `startedAt` is stamped by the first keystroke, never in render. */
  const startedAt = useRef(0);
  const [remaining, setRemaining] = useState(seconds * 1000);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /** What the result was, frozen at the moment the clock ran out. */
  const [result, setResult] = useState<{ wpm: number; accuracy: number; words: number } | null>(null);
  const [beaten, setBeaten] = useState(false);

  useSyncExternalStore(subscribeTests, testsSnapshot, testsServerSnapshot);

  const touch = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(pointer: coarse)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );

  /**
   * Stop the clock and keep the figures.
   *
   * Reads the reducer through its ref rather than through `state`, because
   * this is called from an interval that closed over an older render. The
   * duration is used for the speed rather than the measured elapsed time: the
   * test *is* thirty seconds, and quoting 30.1 because a timer fired late
   * would make two runs of the same test incomparable by a hair.
   */
  const finish = useCallback(() => {
    if (phaseRef.current === 'done') return;
    const at = stateRef.current;
    const wpm = testWpm(at.hits, seconds);
    const accuracy = testAccuracy(at.hits, at.misses);

    setResult({ wpm, accuracy, words: at.words });
    setBeaten(recordTest(seconds, wpm));
    setPhase('done');
    audio.click();
    track({ name: 'typing_test_finished', seconds, wpm, accuracy });
  }, [seconds]);

  /** The countdown, running only while the test is. */
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      const left = startedAt.current + seconds * 1000 - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) finish();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, seconds, finish]);

  /**
   * Stay ahead of the reader. Same rule as the warm-up: fed per committed word
   * so the buffer is topped up long before anybody reaches the end of it.
   */
  useEffect(() => {
    if (state.queue.length >= 2) return;
    dispatch({ type: 'feed', line: randomSentence(state.sentence) });
  }, [state.words, state.queue.length, state.sentence]);

  const typeChar = useCallback((raw: string) => {
    const at = phaseRef.current;
    if (at !== 'ready' && at !== 'running') return;

    /* The first letter is what starts the clock. */
    if (at === 'ready') {
      startedAt.current = Date.now();
      setPhase('running');
      track({ name: 'typing_test_started', seconds });
    }

    const snapshot = stateRef.current;
    const expected = snapshot.sentence[snapshot.cursor];
    if (expected === undefined) return;

    /* Case is not the point in practice, exactly as in the warm-up. */
    const key = raw.toLowerCase();
    if (key !== expected) audio.miss();
    else audio.key(snapshot.words);
    dispatch({ type: 'typed', char: key });
  }, [seconds]);

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
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return; }
      if (document.activeElement === capture.current) return;
      const key = e.key === 'Spacebar' ? ' ' : e.key;
      if (key.length !== 1) return;
      e.preventDefault();
      typeChar(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typeChar, onExit]);

  /** Another go at the same length, from a clean sheet. */
  const again = useCallback(() => {
    dispatch({
      type: 'begin',
      lines: Array.from({ length: SEED_LINES }, () => randomSentence()),
    });
    startedAt.current = 0;
    setRemaining(seconds * 1000);
    setResult(null);
    setBeaten(false);
    setPhase('ready');
  }, [seconds]);

  const choose = useCallback((next: TestSeconds) => {
    setSeconds(next);
    setRemaining(next * 1000);
    setPhase('ready');
  }, []);

  const live = phase === 'ready' || phase === 'running';
  const clock = Math.ceil(remaining / 1000);
  const best = bestAt(seconds);

  /* ---------------------------------------------------------------- */

  if (phase === 'choosing') {
    return (
      <main className={test.chooser}>
        <header className={test.chooserHead}>
          <button className={test.back} onClick={onExit}>← Practice</button>
          <h1 className={`${test.title} pixel-font`}>Typing test</h1>
          <p className={test.note}>
            Type as much as you can before the clock runs out. Nothing here is
            ranked or recorded against your account.
          </p>
        </header>

        <div className={test.lengths}>
          {TEST_SECONDS.map((option) => (
            <button
              key={option}
              className={test.length}
              data-picked={option === seconds || undefined}
              onClick={() => choose(option)}
            >
              <strong className={`${test.lengthValue} pixel-font`}>{option}</strong>
              <span className={test.lengthUnit}>seconds</span>
              {/* Each length keeps its own record, because two tests of
                  different durations are not the same test. */}
              <span className={test.lengthBest}>
                {bestAt(option) > 0 ? `best ${bestAt(option)} wpm` : 'no record yet'}
              </span>
            </button>
          ))}
        </div>

        <p className={test.hint}>The clock starts when you type your first letter.</p>
      </main>
    );
  }

  return (
    <main
      ref={screenRef}
      className={styles.screen}
      data-layout="plain"
      data-keyboard={keyboardUp || undefined}
    >
      <ArenaControls
        className={styles.controls}
        onLeave={onExit}
        leaveLabel="Leave the typing test"
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
            * The clock stands where the warm-up puts its streak: the one
            * figure worth glancing at without leaving the words. Dim until
            * the test is actually running, so a full clock that has not
            * started cannot be mistaken for one that has stopped.
            */}
          <span
            className={`${test.clock} pixel-font`}
            data-live={phase === 'running' || undefined}
            data-low={phase === 'running' && clock <= 5 || undefined}
          >
            {clock}
          </span>
          <span className={test.clockLabel}>
            {phase === 'ready' ? 'type to start' : clock === 1 ? 'second left' : 'seconds left'}
          </span>

          <span className={warm.line}>
            {state.words} {state.words === 1 ? 'word' : 'words'}
            {' · '}
            {Math.round(warmupAccuracy(state) * 100)}% accurate
            {best > 0 && ` · best ${best} wpm`}
          </span>
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
        aria-label="Type here to take the test"
        tabIndex={-1}
        onBlur={() => setKeyboardUp(false)}
      />

      {touch && !keyboardUp && live && (
        <button
          type="button"
          className={styles.tapToType}
          onClick={() => { capture.current?.focus(); setKeyboardUp(true); }}
        >
          Tap to type
        </button>
      )}

      {phase === 'done' && result && (
        <div className={warm.card} role="dialog" aria-label="Typing test result">
          <h2 className={`${warm.cardTitle} pixel-font`}>
            {result.wpm} words a minute
          </h2>

          <dl className={warm.stats}>
            <div>
              <dt>Speed</dt>
              <dd className="pixel-font">{result.wpm}</dd>
            </div>
            <div>
              <dt>Words</dt>
              <dd className="pixel-font">{result.words}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd className="pixel-font">{result.accuracy}%</dd>
            </div>
          </dl>

          <p className={beaten ? warm.record : test.quiet}>
            {beaten
              ? `A new best over ${seconds} seconds.`
              : `Your best over ${seconds} seconds is ${bestAt(seconds)} wpm.`}
          </p>

          <div className={warm.actions}>
            <button className="btn btn-primary" onClick={again}>
              Go again
            </button>
            <button className="btn btn-ghost" onClick={() => setPhase('choosing')}>
              Change the length
            </button>
            <button className="btn btn-ghost" onClick={onExit}>
              Done for now
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
