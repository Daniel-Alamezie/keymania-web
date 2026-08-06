'use client';

/**
 * How far into a module somebody got, and how each lesson went.
 *
 * **Deliberately local, and this is the interesting decision.** The server
 * stores one character per module — a single star for the whole thing — and
 * that encoding is worth protecting: it is what makes progress a dozen bytes
 * riding an existing write rather than a table of its own. Per-lesson results
 * do not fit in it and should not be made to.
 *
 * They also should not be sent, because they are a different currency. A
 * module's stars are three claims (finished it, was clean about it, beat the
 * boss) and none of them is an average of its lessons. Persisting lesson stars
 * server-side would create a second scoring system that has to be reconciled
 * with the first, and the reconciliation would be the bug.
 *
 * So this is a convenience, and it is allowed to be lossy in ways the path
 * itself is not. Cleared browser, different device, private window — the
 * lesson detail is gone and the module's star is not, which is the right way
 * round. Nothing here is ever the authority on whether a module was passed.
 *
 * `localStorage` rather than `sessionStorage`: the whole point is coming back
 * tomorrow, which is a new session.
 */

import { MAX_STARS, type ModuleId } from './learnPath';

const KEY = 'keymania.learn.runs';

export interface LessonResult {
  stars: number;
  accuracy: number;
}

/** What is known about one module, lesson by lesson. Index is lesson order. */
export type ModuleRun = (LessonResult | null)[];

type Runs = Partial<Record<ModuleId, ModuleRun>>;

/**
 * Read whatever is stored, tolerating anything at all.
 *
 * Untrusted on purpose: this is a string a user can edit, a value written by
 * an older build, or nothing. Every failure mode collapses to "no history",
 * which costs somebody a detail panel rather than their progress.
 */
function read(): Runs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Runs;
  } catch {
    return {};
  }
}

function write(runs: Runs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    // Storage disabled or full. The module still plays; it just will not be
    // remembered, which is the degradation this whole file is designed for.
  }
}

/** Clamp anything read back off disk into something renderable. */
const sane = (result: LessonResult | null): LessonResult | null => {
  if (!result || typeof result !== 'object') return null;
  const stars = Number(result.stars);
  const accuracy = Number(result.accuracy);
  if (!Number.isFinite(stars)) return null;
  return {
    stars: Math.max(0, Math.min(MAX_STARS, Math.trunc(stars))),
    accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : 0,
  };
};

/** What is known about a module's lessons, padded to the length asked for. */
export function runFor(id: ModuleId, lessons: number): ModuleRun {
  const stored = read()[id] ?? [];
  return Array.from({ length: lessons }, (_, at) => sane(stored[at] ?? null));
}

/**
 * Record one lesson.
 *
 * Keeps the better of the two, for the same reason the server does: replaying
 * a lesson and doing worse must not erase what an earlier attempt showed, or
 * practising becomes something to avoid.
 */
export function recordLesson(id: ModuleId, at: number, result: LessonResult): void {
  const runs = read();
  const existing = runs[id] ?? [];
  const held = sane(existing[at] ?? null);
  if (held && held.stars >= result.stars) return;

  const next = [...existing];
  next[at] = result;
  runs[id] = next;
  write(runs);
}

/**
 * The lesson to open on: the first not yet passed, or the last if all are.
 *
 * "First unpassed" rather than "one after the last attempted", because
 * somebody who skipped ahead and came back should be sent to the gap rather
 * than past it. When every lesson is done the module is being replayed, and
 * the honest place to land is the start.
 */
export function resumeAt(id: ModuleId, lessons: number): number {
  const run = runFor(id, lessons);
  const gap = run.findIndex((result) => !result || result.stars <= 0);
  return gap === -1 ? 0 : gap;
}

/** Whether a module has been started but not finished. */
export function inProgress(id: ModuleId, lessons: number): boolean {
  const run = runFor(id, lessons);
  const done = run.filter((result) => result && result.stars > 0).length;
  return done > 0 && done < lessons;
}

/**
 * Forget every remembered lesson.
 *
 * A real operation rather than a test hook: somebody wanting to walk the path
 * again from nothing has to be able to, and the dev harness at /dev/learn
 * needs it to put the app into a first-run state. The server keeps the module
 * stars either way, so this clears the detail and not the progress.
 */
export function clearRuns(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* Nothing stored, nothing to clear. */
  }
}

/** How many of a module's lessons have been passed. */
export const lessonsDone = (id: ModuleId, lessons: number): number =>
  runFor(id, lessons).filter((result) => result && result.stars > 0).length;
