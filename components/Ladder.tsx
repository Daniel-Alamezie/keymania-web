'use client';

import { useMemo, useState } from 'react';
import {
  completedCount, MAX_STARS, MODULES, nextModuleId, nodeState, starsFor,
  type LearnModule, type ModuleId, type NodeState,
} from '@/game/learnPath';
import styles from './Ladder.module.css';

export interface LadderProps {
  /** The progress string from the profile. Undefined for somebody new. */
  progress: string | undefined;
  onStart: (id: ModuleId) => void;
  onExit: () => void;
  /**
   * The how-to-play guide, which the menu no longer links to directly.
   *
   * It lives here because Learn is the real answer to "new here?", and two
   * doors for one intention means most people pick neither. One level in, from
   * the screen somebody reached by asking that question, it is where the
   * remaining questions about the game itself belong.
   */
  onGuide: () => void;
}

/**
 * Which view of the path is being shown.
 *
 * Both are built rather than one being chosen up front, because the question
 * they answer is not the same and it was not obvious from a description which
 * wins. The list is navigation: twelve named things, in order, with the next
 * one marked — it says *what to do now*. The keyboard is the picture: keys
 * lighting up in groups as they are learned, which says *how much of this
 * machine you own*, and is the thing a list structurally cannot show.
 *
 * The list leads because the ladder's stated job is answering "where am I" at
 * a glance, and a keyboard answers "how far" instead — it takes a legend to
 * turn a lit key into a module you can start. The keyboard is the better
 * motivator and the worse menu, so it sits alongside rather than instead.
 */
type View = 'path' | 'keys';

/**
 * The board, as a beginner meets it.
 *
 * Four rows and no modifiers: this is a map of the keys the path teaches, not
 * a picture of a keyboard. Ctrl and Alt would be honest and would only make
 * every real key smaller on the screen that can least afford it.
 */
const ROWS = ['1234567890', 'qwertyuiop', "asdfghjkl;", 'zxcvbnm,.'] as const;

/** Which module introduces each key, for colouring the board. */
const OWNER = new Map<string, ModuleId>(
  MODULES.flatMap((module) => [...module.keys].map((key) => [key, module.id] as const)),
);

const Stars = ({ earned }: { earned: number }) => (
  <span className={styles.stars} aria-hidden="true">
    {Array.from({ length: MAX_STARS }, (_, i) => (
      <span key={i} className={styles.star} data-earned={i < earned || undefined}>★</span>
    ))}
  </span>
);

const FLAG: Record<NodeState, string> = {
  done: 'PASSED',
  next: 'START HERE',
  locked: 'LOCKED',
};

export default function Ladder({ progress, onStart, onExit, onGuide }: LadderProps) {
  const [view, setView] = useState<View>('path');

  const frontier = nextModuleId(progress);
  const passed = completedCount(progress);

  /**
   * The module the keyboard view is talking about.
   *
   * Null means "whatever is next", which is the state somebody arrives in. A
   * lit key with no caption is a decoration; the caption is what makes the
   * keyboard usable as a menu at all.
   */
  const [picked, setPicked] = useState<ModuleId | null>(null);
  const focus: LearnModule | undefined = useMemo(() => {
    const id = picked ?? frontier;
    return MODULES.find((module) => module.id === id);
  }, [picked, frontier]);

  const start = (id: ModuleId) => {
    if (nodeState(progress, id) === 'locked') return;
    onStart(id);
  };

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Learn to type</h1>
        <span className={styles.progress}>{passed} / {MODULES.length}</span>
        <button className="btn btn-ghost" onClick={onExit}>Back</button>
      </header>

      <div className={styles.views} role="tablist" aria-label="How to view the path">
        {(['path', 'keys'] as const).map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={view === option}
            className={`${styles.viewBtn} pixel-font`}
            data-on={view === option || undefined}
            onClick={() => setView(option)}
          >
            {option === 'path' ? 'PATH' : 'KEYBOARD'}
          </button>
        ))}
      </div>

      {view === 'path' ? (
        <div className={styles.path}>
          {MODULES.map((module, at) => {
            const state = nodeState(progress, module.id);
            const stars = starsFor(progress, module.id);
            return (
              <button
                key={module.id}
                className={styles.node}
                data-state={state}
                disabled={state === 'locked'}
                onClick={() => start(module.id)}
                aria-label={`${module.title}. ${FLAG[state]}.${
                  state === 'done' ? ` ${stars} of ${MAX_STARS} stars.` : ''
                }`}
              >
                <span className={`${styles.pip} pixel-font`} aria-hidden="true">
                  {state === 'locked' ? '🔒' : at + 1}
                </span>
                <span className={styles.body}>
                  <span className={`${styles.name} pixel-font`}>{module.title}</span>
                  <span className={styles.teaches}>{module.teaches}</span>
                </span>
                <span className={styles.tail}>
                  {state === 'done' && <Stars earned={stars} />}
                  <span className={`${styles.flag} pixel-font`}>{FLAG[state]}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className={styles.keyboard}>
            {ROWS.map((row) => (
              <div key={row} className={styles.krow}>
                {[...row].map((key) => {
                  const owner = OWNER.get(key);
                  /* A key no module claims stays dark rather than pretending
                     to be locked behind something that will never open it. */
                  const state = owner ? nodeState(progress, owner) : 'locked';
                  const owning = owner && MODULES.find((m) => m.id === owner);
                  return (
                    <button
                      key={key}
                      className={`${styles.key} pixel-font`}
                      data-state={state}
                      disabled={!owner || state === 'locked'}
                      onClick={() => owner && setPicked(owner)}
                      aria-label={owning ? `${key}, taught by ${owning.title}` : key}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className={styles.legend}>
            <span className={styles.swatch}>
              <span className={styles.chip} data-state="done" /> learned
            </span>
            <span className={styles.swatch}>
              <span className={styles.chip} data-state="next" /> next up
            </span>
            <span className={styles.swatch}>
              <span className={styles.chip} /> not yet
            </span>
          </div>

          {focus && (
            <div className={styles.focus}>
              <p className={`${styles.focusName} pixel-font`}>{focus.title}</p>
              <p className={styles.focusTeaches}>{focus.teaches}</p>
              <button
                className="btn btn-primary"
                disabled={nodeState(progress, focus.id) === 'locked'}
                onClick={() => start(focus.id)}
              >
                {nodeState(progress, focus.id) === 'done' ? 'Practise again' : 'Start'}
              </button>
            </div>
          )}
        </>
      )}

      <button className={styles.guide} onClick={onGuide}>
        How the game itself works
      </button>

      {!frontier && (
        <div className={styles.done}>
          <p className={`${styles.focusName} pixel-font`}>Every module passed</p>
          <p className={styles.focusTeaches}>
            Go back for the stars you left behind, or take it into a duel.
          </p>
        </div>
      )}
    </main>
  );
}
