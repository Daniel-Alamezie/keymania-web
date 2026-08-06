'use client';

import { useCallback, useState } from 'react';
import { MODULE_IDS, MODULES, type ModuleId } from '@/game/learnPath';
import { contentFor } from '@/game/curriculum';
import { clearRuns, lessonsDone, recordLesson } from '@/game/moduleRun';
import { clearLocal, localSnapshot, recordLocal } from '@/game/localPath';
import { markSeen } from '@/game/tutorialSeen';
import styles from './LearnLab.module.css';

/**
 * Every state a player of the path can be in, reachable in one click.
 *
 * Play-testing means visiting states that normally cost an hour to earn: a
 * fresh arrival, a module part-finished, everything but the final boss, a
 * guest carrying local progress. Reaching those by playing is not testing,
 * it is waiting, and the states nobody bothers to reach are exactly where
 * the bugs live.
 *
 * **This seeds the browser, not the server.** Module stars live on the
 * account and are set separately; what lives here is the per-lesson detail in
 * `moduleRun`, the guest path in `localPath`, and whether the tutorial has
 * been read. That split is real rather than a limitation of this page: the
 * server holds what you earned, the browser holds what this device saw.
 *
 * Everything goes through the app's own functions rather than writing storage
 * keys directly, so a scenario cannot drift from what the game would actually
 * have written.
 */

/** A lesson result good enough to pass, and to clear the 95% boss gate. */
const CLEAN = { stars: 3, accuracy: 0.99 };
/** Finished, but under the gate: the state that should hold the boss shut. */
const SLOPPY = { stars: 1, accuracy: 0.72 };

export default function LearnLab() {
  const [note, setNote] = useState('Pick a scenario.');

  const seedAll = useCallback((result: { stars: number; accuracy: number }) => {
    for (const id of MODULE_IDS) {
      const lessons = contentFor(id)?.lessons.length ?? 0;
      for (let at = 0; at < lessons; at += 1) recordLesson(id, at, result);
    }
  }, []);

  const scenarios: { label: string; hint: string; run: () => string }[] = [
    {
      label: 'Fresh arrival',
      hint: 'Nothing read, nothing typed, no guest progress. What a stranger sees.',
      run: () => {
        clearRuns();
        clearLocal();
        try { window.localStorage.removeItem('keymania.learn.tutorial.v1'); } catch { /* none */ }
        return 'Cleared. The tutorial is unread and every lesson is shut.';
      },
    },
    {
      label: 'Every lesson done, cleanly',
      hint: 'All lessons passed at 99%, so every boss is open. Use with all-stars on the account.',
      run: () => {
        seedAll(CLEAN);
        markSeen();
        return 'Every lesson passed at 99%. All bosses open.';
      },
    },
    {
      label: 'Every lesson done, sloppily',
      hint: 'Finished at 72%, which should hold every boss shut behind the 95% gate.',
      run: () => {
        seedAll(SLOPPY);
        markSeen();
        return 'Every lesson finished at 72%. Bosses should all say 95% OPENS THIS.';
      },
    },
    {
      label: 'Part way through module 3',
      hint: 'Lesson one done, two and three waiting. Tests resume and the in-order gate.',
      run: () => {
        clearRuns();
        recordLesson('top-common', 0, CLEAN);
        markSeen();
        return 'Module 3 has lesson 1 done. It should offer Resume lesson 2.';
      },
    },
    {
      label: 'Guest, two modules in',
      hint: 'Local progress with no account. Sign in from here to test the merge.',
      run: () => {
        clearRuns();
        clearLocal();
        recordLocal('home-row', 3);
        recordLocal('home-row-full', 3);
        seedAll(CLEAN);
        markSeen();
        return `Guest path seeded: ${localSnapshot()}. Sign in to watch it merge.`;
      },
    },
    {
      label: 'Tutorial unread',
      hint: 'Leaves progress alone, but the hand tutorial says START HERE again.',
      run: () => {
        try { window.localStorage.removeItem('keymania.learn.tutorial.v1'); } catch { /* none */ }
        return 'Tutorial marked unread. Reload to see it.';
      },
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Learn scenarios</h1>
        <p className={styles.note}>
          Dev only. Seeds this browser, not the account: module stars live on
          the server and are set separately. Reload the game after picking one.
        </p>
      </header>

      <div className={styles.grid}>
        {scenarios.map((scenario) => (
          <button
            key={scenario.label}
            className={styles.card}
            onClick={() => setNote(scenario.run())}
          >
            <strong className="pixel-font">{scenario.label}</strong>
            <span>{scenario.hint}</span>
          </button>
        ))}
      </div>

      <p className={`${styles.result} pixel-font`}>{note}</p>

      {/* What the browser currently holds, so a scenario can be confirmed
          rather than assumed. */}
      <section className={styles.state}>
        <h2 className={`${styles.stateTitle} pixel-font`}>This browser now</h2>
        <p className={styles.note}>Guest path: {localSnapshot() || 'empty'}</p>
        <ul className={styles.list}>
          {MODULES.map((module) => {
            const lessons = contentFor(module.id)?.lessons.length ?? 0;
            return (
              <li key={module.id}>
                <span>{module.title}</span>
                <span className={styles.dim}>
                  {lessonsDone(module.id as ModuleId, lessons)} / {lessons} lessons
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* A full page load, deliberately, and not a Link: the scenario has just
          rewritten localStorage, and the game reads that as it mounts. A
          client navigation would work today and break the moment anything
          starts caching across routes. */}
      <button
        className={styles.back}
        onClick={() => window.location.assign('/?learn=1')}
      >
        Go to the path
      </button>
    </main>
  );
}
