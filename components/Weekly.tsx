'use client';

import {
  useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
} from 'react';
import { initialWeekly, weeklyReducer, type WeeklyState } from '@/game/weeklyReducer';
import { WEEKLY_MS } from '@/game/weeklyClock';
import { useConfirmKey } from '@/game/useConfirmKey';
import { audio } from '@/game/audio';
import { FALLBACK_COUNTDOWN_MS, tickDelay } from '@/game/countdown';
import { track as trackEvent } from '@/game/analytics';
import type { MessageHandler } from '@/game/useDuelSocket';
import SentenceView from './SentenceView';
import ArenaScene from './ArenaScene';
import SoundToggle from './SoundToggle';
import RunPause from './RunPause';
import styles from './Survival.module.css';
import weekly from './Weekly.module.css';
import { useVisualViewport } from '@/game/useVisualViewport';

export interface WeeklyConfig {
  script: string[];
  countdownMs: number | undefined;
  subscribe: (handler: MessageHandler) => () => void;
  onWord: (word: string) => void;
  onFinish: () => void;
  onExit: () => void;
  onAgain: () => void;
  starting: boolean;
}

/** What the server said when the run closed. The end card renders only this. */
interface Scored {
  week: string;
  run?: { chars: number; words: number; wpm: number; lastMs: number };
  best?: { chars: number; words: number; wpm: number; lastMs: number };
  improved: boolean;
}

/**
 * The weekly sprint: thirty seconds against the week's script.
 *
 * Survival's screen with the forge swapped for a clock, and it borrows
 * Survival.module.css wholesale for the shared shell — the input capture, the
 * stream, the overlays — adding only its own time bar and end card. The input
 * machinery is the same deliberate copy Survival made of the duel's, third
 * copy now, same shelf-life note: it unifies when there is a DOM test rig to
 * prove the unified one behaves.
 *
 * A typo here flinches and stays. The clock is the whole opponent, and it
 * runs on the server's own stamps — the bar below is a courtesy, not the
 * referee.
 */
export default function Weekly({
  script, countdownMs, subscribe, onWord, onFinish, onExit, onAgain, starting,
}: WeeklyConfig) {
  const [state, dispatch] = useReducer(
    weeklyReducer,
    script,
    (from) => weeklyReducer(initialWeekly(), { type: 'begin', script: from }),
  );
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [scored, setScored] = useState<Scored | null>(null);
  /**
   * Whether the way-out dialog is up.
   *
   * A ref beside the state because `typeChar` is a memoised callback and
   * would otherwise close over a stale value — the same reason the reducer
   * state is mirrored into `stateRef` two lines below.
   */
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const capture = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useVisualViewport(screenRef, setKeyboardUp);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const track = (id: ReturnType<typeof setTimeout>) => { timers.current.push(id); return id; };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

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
    // Once per run; the component is keyed on the run in Game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deadline = useRef(0);
  useEffect(() => {
    if (state.phase !== 'countdown') return;
    if (!deadline.current) {
      deadline.current = Date.now() + (countdownMs ?? FALLBACK_COUNTDOWN_MS);
    }
    const delay = tickDelay(deadline.current - Date.now(), state.countdown);
    const id = track(setTimeout(() => dispatch({ type: 'countdown' }), delay));
    return () => clearTimeout(id);
  }, [state.phase, state.countdown, countdownMs]);

  const typeChar = useCallback((raw: string) => {
    const key = raw.toLowerCase();
    const snapshot = stateRef.current;
    if (snapshot.phase !== 'running') return;
    // The run carries on underneath, but the keyboard belongs to the dialog.
    if (pausedRef.current) return;

    const expected = snapshot.sentence[snapshot.cursor];

    if (key !== expected) {
      // A flinch, not a funeral. The referee never hears about it — nothing
      // was committed, and the cost was already paid in time.
      audio.miss();
      dispatch({ type: 'typed', char: key, now: Date.now() });
      return;
    }

    audio.key(snapshot.words);

    if (expected === ' ') {
      const start = snapshot.sentence.lastIndexOf(' ', snapshot.cursor - 1) + 1;
      onWord(snapshot.sentence.slice(start, snapshot.cursor));
    }

    dispatch({ type: 'typed', char: key, now: Date.now() });
  }, [onWord]);

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
    if (state.phase !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Escape opens the way out rather than taking it, and closes it again.
      // Leaving on a single keypress cost people runs, which is what this is.
      if (e.key === 'Escape') { e.preventDefault(); setPaused((was) => !was); return; }
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
   * The local thirty seconds, which close the run when the player simply
   * stops typing — nothing else would ever reach the server to close it.
   * Padded a moment past the window so a word already in flight lands inside
   * the server's own deadline rather than being cut off by ours; the server
   * clamps everything to its clock regardless.
   */
  useEffect(() => {
    if (state.phase !== 'running' || !state.startedAt) return;
    const left = state.startedAt + WEEKLY_MS + 400 - Date.now();
    const id = track(setTimeout(() => {
      const snapshot = stateRef.current;
      if (snapshot.phase !== 'running') return;
      onFinish();
      audio.finishSwell(true);
      dispatch({ type: 'end', now: Date.now() });
    }, Math.max(0, left)));
    return () => clearTimeout(id);
  }, [state.phase, state.startedAt, onFinish]);

  /** The clock on screen, ticking at display rate only. */
  const [msLeft, setMsLeft] = useState(WEEKLY_MS);
  useEffect(() => {
    // No reset branch: the component is keyed per run in Game, so a fresh
    // mount starts the state at the full window on its own — and setting
    // state synchronously in an effect is the cascading render lint forbids.
    if (state.phase !== 'running' || !state.startedAt) return;
    const id = setInterval(() => {
      setMsLeft(Math.max(0, state.startedAt + WEEKLY_MS - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [state.phase, state.startedAt]);

  /** The referee's word: acks keep the count honest, the end scores it. */
  useEffect(() => subscribe((message) => {
    if (message.type === 'weeklyWord') {
      dispatch({ type: 'confirm', words: message.wordIndex });
      if (message.ended) dispatch({ type: 'end', now: Date.now() });
      return;
    }
    if (message.type === 'weeklyEnd') {
      setScored({
        week: message.week, run: message.run, best: message.best, improved: message.improved,
      });
      dispatch({ type: 'end', now: Date.now() });
    }
  }), [subscribe]);

  const over = state.phase === 'over';
  const goAgain = useMemo(
    () => (over && !starting ? onAgain : null),
    [over, starting, onAgain],
  );
  useConfirmKey(goAgain);

  const seconds = Math.ceil(msLeft / 1000);

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
          aria-label="Leave the sprint"
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
          {/* Seconds, huge, because the clock is the opponent. Words ride
              underneath in the quiet type: they are the score, but mid-run
              the only decision a player makes is about time. */}
          <span
            className={`${weekly.clock} pixel-font`}
            data-late={(state.startedAt > 0 && seconds <= 5) || undefined}
          >
            {state.startedAt ? seconds : 30}
          </span>
          <div className={weekly.track} aria-hidden="true">
            <div
              className={weekly.fill}
              style={{ width: `${(msLeft / WEEKLY_MS) * 100}%` }}
            />
          </div>
          <span className={weekly.words}>{state.words} words</span>
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
        aria-label="Type here to sprint"
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
          warning="The thirty seconds are still running. This does not stop the clock."
          onResume={() => setPaused(false)}
          /* Both ways out finish the attempt first: it frees the room and
             scores what was genuinely typed inside the window, so leaving
             costs the run rather than the work. */
          onRestart={() => { setPaused(false); onFinish(); onAgain(); }}
          onExit={() => { setPaused(false); onFinish(); onExit(); }}
          restarting={starting}
        />
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
            {/*
              * The card waits for the referee. Between the local end and the
              * weeklyEnd message there is a round trip during which the only
              * honest figures are none — showing local numbers and then
              * correcting them is the score visibly changing on the card.
              */}
            {!scored ? (
              <h1 className={`${styles.resultTitle} pixel-font`}>Scoring…</h1>
            ) : (
              <>
                <h1 className={`${styles.resultTitle} pixel-font`}>
                  {scored.run ? `${scored.run.words} words` : 'Too quick to score'}
                </h1>
                {scored.improved && scored.run && (
                  <p className={`${weekly.newBest} pixel-font`}>NEW WEEKLY BEST</p>
                )}
                <p className={styles.reason}>
                  {scored.run
                    ? `${scored.run.wpm} wpm on this week's script.`
                    : 'Land at least a couple of words inside the thirty seconds.'}
                </p>
                {scored.best && !scored.improved && (
                  <p className={styles.stat}>
                    Your week&apos;s best: {scored.best.words} words at {scored.best.wpm} wpm
                  </p>
                )}
              </>
            )}
            <button
              className="btn btn-primary"
              onClick={onAgain}
              disabled={starting}
              data-working={starting || undefined}
            >
              {starting ? 'Setting the line' : 'Go again'}
            </button>
            <button className="btn btn-ghost" onClick={onExit}>Back</button>
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

export type { WeeklyState };
