import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inProgress, lessonsDone, recordLesson, resumeAt, runFor,
} from '../moduleRun';

/** A localStorage that behaves, so the store's own rules are what is tested. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
});

describe('an untouched module', () => {
  it('knows nothing, in the shape the panel expects', () => {
    expect(runFor('home-row', 3)).toEqual([null, null, null]);
    expect(lessonsDone('home-row', 3)).toBe(0);
    expect(inProgress('home-row', 3)).toBe(false);
  });

  it('opens on the first lesson', () => {
    expect(resumeAt('home-row', 3)).toBe(0);
  });
});

describe('recording lessons', () => {
  it('remembers a result against its own lesson', () => {
    recordLesson('home-row', 1, { stars: 2, accuracy: 0.96 });
    expect(runFor('home-row', 3)).toEqual([null, { stars: 2, accuracy: 0.96 }, null]);
  });

  /** The same rule the server keeps: practising must never cost anything. */
  it('keeps the better of two attempts', () => {
    recordLesson('home-row', 0, { stars: 3, accuracy: 1 });
    recordLesson('home-row', 0, { stars: 1, accuracy: 0.5 });
    expect(runFor('home-row', 3)[0]).toEqual({ stars: 3, accuracy: 1 });
  });

  it('lets a better attempt through', () => {
    recordLesson('home-row', 0, { stars: 1, accuracy: 0.5 });
    recordLesson('home-row', 0, { stars: 3, accuracy: 1 });
    expect(runFor('home-row', 3)[0]!.stars).toBe(3);
  });

  it('keeps modules apart', () => {
    recordLesson('home-row', 0, { stars: 3, accuracy: 1 });
    expect(runFor('home-row-full', 3)).toEqual([null, null, null]);
  });
});

describe('coming back', () => {
  it('resumes at the first lesson not yet passed', () => {
    recordLesson('home-row', 0, { stars: 2, accuracy: 0.9 });
    expect(resumeAt('home-row', 3)).toBe(1);
  });

  /** Sent to the gap, not past it, for somebody who skipped ahead. */
  it('sends somebody back to a lesson they skipped', () => {
    recordLesson('home-row', 0, { stars: 2, accuracy: 0.9 });
    recordLesson('home-row', 2, { stars: 2, accuracy: 0.9 });
    expect(resumeAt('home-row', 3)).toBe(1);
  });

  it('starts a fully passed module again from the beginning', () => {
    for (let at = 0; at < 3; at += 1) recordLesson('home-row', at, { stars: 2, accuracy: 0.9 });
    expect(resumeAt('home-row', 3)).toBe(0);
    expect(inProgress('home-row', 3)).toBe(false);
    expect(lessonsDone('home-row', 3)).toBe(3);
  });

  it('counts a module as in progress only part way through', () => {
    recordLesson('home-row', 0, { stars: 1, accuracy: 0.6 });
    expect(inProgress('home-row', 3)).toBe(true);
  });
});

/**
 * This is a string a user can edit and an older build can have written. Every
 * failure collapses to "no history", which costs a detail panel rather than
 * anybody's progress — the module star lives on the server and is untouched.
 */
describe('what is on disk cannot be trusted', () => {
  it.each([
    ['not json', '}{'],
    ['an array', '[1,2,3]'],
    ['null', 'null'],
    ['a string', '"nope"'],
  ])('survives %s', (_label, raw) => {
    window.localStorage.setItem('keymania.learn.runs', raw);
    expect(runFor('home-row', 3)).toEqual([null, null, null]);
  });

  it('clamps a star count someone typed in by hand', () => {
    window.localStorage.setItem(
      'keymania.learn.runs',
      JSON.stringify({ 'home-row': [{ stars: 99, accuracy: 5 }] }),
    );
    expect(runFor('home-row', 3)[0]).toEqual({ stars: 3, accuracy: 1 });
  });

  it('drops a garbled entry without losing its neighbours', () => {
    window.localStorage.setItem(
      'keymania.learn.runs',
      JSON.stringify({ 'home-row': ['rubbish', { stars: 2, accuracy: 0.9 }] }),
    );
    expect(runFor('home-row', 3)).toEqual([null, { stars: 2, accuracy: 0.9 }, null]);
  });

  it('carries on when storage refuses to be written to', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('quota'); },
      } as unknown as Storage,
    });
    expect(() => recordLesson('home-row', 0, { stars: 3, accuracy: 1 })).not.toThrow();
  });
});
