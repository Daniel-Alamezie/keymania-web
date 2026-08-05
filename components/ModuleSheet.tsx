'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_STARS, moduleById, starsFor, type ModuleId } from '@/game/learnPath';
import { flameHeat, flameStage } from '@/game/flame';
import PathFlame from './PathFlame';
import { contentFor } from '@/game/curriculum';
import { lessonsDone, resumeAt, runFor } from '@/game/moduleRun';
import styles from './ModuleSheet.module.css';

export interface ModuleSheetProps {
  module: ModuleId;
  /** The path string, for the module's own star. */
  progress: string | undefined;
  /** Start at a specific lesson. The boss is index `lessons.length`. */
  onStart: (at: number) => void;
  onBack: () => void;
}

const Stars = ({ earned, of = MAX_STARS }: { earned: number; of?: number }) => (
  <span className={styles.stars} aria-hidden="true">
    {Array.from({ length: of }, (_, i) => (
      <span key={i} className={styles.star} data-earned={i < earned || undefined}>★</span>
    ))}
  </span>
);

/**
 * What a module is, before committing to it.
 *
 * Added because "3 lessons + boss" on a node raises the question it does not
 * answer: *which ones have I done?* A player part way through a module had no
 * way to see that and, worse, no way back to it — the run lived in component
 * state and a module left half-finished restarted from lesson one.
 *
 * **Lesson stars are shown but never sent.** They come from `moduleRun`, which
 * is local storage, and they are a different currency from the module's own
 * star: a module is passed on three claims (finished it, was clean, beat the
 * boss) and none of them is an average of its lessons. Showing both is fine as
 * long as the panel is clear about which is which, which is why the module's
 * star sits in the header and the lesson stars sit in the list.
 *
 * It follows that this panel is allowed to forget. A cleared browser loses the
 * lesson detail and keeps the module's star, which is the right way round.
 */
export default function ModuleSheet({ module, progress, onStart, onBack }: ModuleSheetProps) {
  /**
   * The same fire as the ladder, burning at the same size.
   *
   * Tracking the whole path rather than this one module, which is the point:
   * tapping into a module is going one level in, not starting again, and a
   * flame that shrank to one module's worth on the way would read as progress
   * being taken away. It is the same fire, seen from closer.
   *
   * Hooks sit above the early return below, because they cannot be conditional.
   */
  const screen = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    const node = screen.current;
    if (!node) return;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setScrolled(node.scrollTop);
      });
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  const meta = moduleById(module);
  const content = contentFor(module);
  if (!meta || !content) return null;

  const lessons = content.lessons;
  const run = runFor(module, lessons.length);
  const done = lessonsDone(module, lessons.length);
  const at = resumeAt(module, lessons.length);
  const moduleStars = starsFor(progress, module);
  const started = done > 0;

  return (
    <main className={styles.screen} ref={screen}>
      <PathFlame
        heat={flameHeat(progress)}
        stage={flameStage(progress)}
        offset={scrolled}
      />

      <header className={styles.head}>
        <button className="btn btn-ghost" onClick={onBack}>← Path</button>
        <span className={styles.count}>{done} / {lessons.length} lessons</span>
      </header>

      <div className={styles.card}>
        <h1 className={`${styles.title} pixel-font`}>{meta.title}</h1>
        <p className={styles.teaches}>{meta.teaches}</p>
        {/* The module's own star, kept apart from the lesson stars below so
            the two currencies are never read as one running total. */}
        <Stars earned={moduleStars} />
        <p className={styles.rule}>
          One star for finishing. Another for staying above 95%.
          A third for beating the boss.
        </p>
      </div>

      <ol className={styles.list}>
        {lessons.map((lesson, i) => {
          const result = run[i];
          const passed = Boolean(result && result.stars > 0);
          const current = i === at && !passed;
          return (
            <li key={lesson.title}>
              <button
                className={styles.row}
                data-state={passed ? 'done' : current ? 'next' : 'todo'}
                onClick={() => onStart(i)}
              >
                <span className={`${styles.pip} pixel-font`} aria-hidden="true">{i + 1}</span>
                <span className={styles.body}>
                  <span className={`${styles.name} pixel-font`}>{lesson.title}</span>
                  {/* Accuracy rather than a star count alone: it is the number
                      the second star is actually about, and seeing 91% says
                      what "one star" does not. */}
                  <span className={styles.note}>
                    {result
                      ? `${Math.round(result.accuracy * 100)}% accurate`
                      : `${lesson.script.length} lines`}
                  </span>
                </span>
                {passed ? <Stars earned={result!.stars} /> : (
                  <span className={`${styles.flag} pixel-font`}>
                    {current ? 'NEXT' : 'NOT YET'}
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {/* The boss, in the list because it is part of the module, and set
            apart because it is not a lesson — it is the thing they are for. */}
        <li>
          <button
            className={`${styles.row} ${styles.boss}`}
            data-state={done >= lessons.length ? 'next' : 'todo'}
            onClick={() => onStart(lessons.length)}
          >
            <span className={`${styles.pip} pixel-font`} aria-hidden="true">⚔</span>
            <span className={styles.body}>
              <span className={`${styles.name} pixel-font`}>The boss</span>
              <span className={styles.note}>
                a duel using only the keys this module teaches
              </span>
            </span>
            <span className={`${styles.flag} pixel-font`}>
              {moduleStars >= MAX_STARS ? 'BEATEN' : 'THIRD STAR'}
            </span>
          </button>
        </li>
      </ol>

      <button className="btn btn-primary" onClick={() => onStart(at)}>
        {/* A finished module has nothing to resume; replaying is the offer,
            and stars only climb, so it costs nothing. */}
        {done >= lessons.length
          ? 'Practise again'
          : started ? `Resume — lesson ${at + 1}` : 'Start'}
      </button>
    </main>
  );
}
