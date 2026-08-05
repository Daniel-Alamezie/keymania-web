import { describe, expect, it } from 'vitest';
import {
  completedCount, isUnlocked, masteredCount, MAX_STARS, moduleById, MODULE_IDS, MODULES,
  nextModuleId, nodeState, starsFor, taughtBy,
} from '../learnPath';

describe('the module order', () => {
  /**
   * The same pin as `PINNED_ORDER` in keymania-api's `lib/path.test.ts`, and it
   * has to be copied rather than imported: the two repos do not share code, and
   * this list is the only thing keeping them in step.
   *
   * A mismatch is silent in every other way. It does not fail typecheck and it
   * does not throw — it reads a player's progress at the wrong offset, showing
   * stars against modules they never passed. If this test is ever changed,
   * the API's copy has to change in the same commit.
   */
  const PINNED_ORDER = [
    'home-row', 'home-row-full', 'top-common', 'top-row', 'top-edges',
    'bottom-common', 'bottom-row', 'capitals', 'numbers', 'punctuation',
    'awkward', 'rhythm',
  ];

  it('has not been reordered', () => {
    expect([...MODULE_IDS]).toEqual(PINNED_ORDER);
  });

  it('is allowed to grow, but only at the end', () => {
    expect(MODULE_IDS.slice(0, PINNED_ORDER.length)).toEqual(PINNED_ORDER);
  });

  it('has no duplicate ids', () => {
    expect(new Set(MODULE_IDS).size).toBe(MODULE_IDS.length);
  });
});

describe('the catalogue', () => {
  /** A node the ladder can draw but not name would render as a blank tile. */
  it('describes every module in the path, in the same order', () => {
    expect(MODULES.map((m) => m.id)).toEqual([...MODULE_IDS]);
  });

  it('gives every module a title and something to say about what it teaches', () => {
    for (const entry of MODULES) {
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.teaches.trim().length).toBeGreaterThan(0);
    }
  });

  it('finds a module by id, and refuses one it does not know', () => {
    expect(moduleById('numbers')?.title).toBe('Numbers');
    expect(moduleById('not-a-module')).toBeUndefined();
  });

  /**
   * New keys only. `taughtBy` sums them, so a module repeating a key it merely
   * reuses would be harmless here and misleading on the ladder, which shows
   * this field to say what is new.
   */
  it('never re-teaches a key an earlier module already introduced', () => {
    const seen = new Set<string>();
    for (const entry of MODULES) {
      for (const key of entry.keys) {
        expect(seen.has(key), `${entry.id} re-teaches "${key}"`).toBe(false);
        seen.add(key);
      }
    }
  });
});

describe('reading progress', () => {
  it('reads a star off the character at the module position', () => {
    expect(starsFor('310', 'home-row')).toBe(3);
    expect(starsFor('310', 'home-row-full')).toBe(1);
    expect(starsFor('310', 'top-common')).toBe(0);
  });

  /** The normal case for anyone who has not reached the end, not a fault. */
  it('treats a short progress string as unstarted rather than broken', () => {
    expect(starsFor('3', 'rhythm')).toBe(0);
    expect(starsFor(undefined, 'home-row')).toBe(0);
  });

  it('clamps a character a newer server might have written', () => {
    expect(starsFor('9', 'home-row')).toBe(MAX_STARS);
    expect(starsFor('x', 'home-row')).toBe(0);
  });

  it('counts what has been passed and what has been mastered', () => {
    expect(completedCount('3120')).toBe(3);
    expect(masteredCount('3120')).toBe(1);
  });
});

describe('unlocking', () => {
  it('always opens the first module', () => {
    expect(isUnlocked(undefined, 'home-row')).toBe(true);
  });

  /**
   * One star, not three. Gating progress on mastery turns the path into a wall
   * for exactly the people it was built for.
   */
  it('opens the next module on a single star', () => {
    expect(isUnlocked('1', 'home-row-full')).toBe(true);
    expect(isUnlocked('0', 'home-row-full')).toBe(false);
  });

  it('keeps everything past the frontier shut', () => {
    expect(isUnlocked('1', 'top-common')).toBe(false);
  });

  it('sends a new player to the first module and a returning one to their frontier', () => {
    expect(nextModuleId(undefined)).toBe('home-row');
    expect(nextModuleId('31')).toBe('top-common');
  });

  it('has nowhere left to send somebody who has passed everything', () => {
    expect(nextModuleId('1'.repeat(MODULE_IDS.length))).toBeUndefined();
  });
});

/**
 * The ladder's only job is answering "where am I" at a glance, so there are
 * three states and no more.
 */
describe('node state', () => {
  it('marks a passed module done, whatever it was passed at', () => {
    expect(nodeState('1', 'home-row')).toBe('done');
    expect(nodeState('3', 'home-row')).toBe('done');
  });

  it('marks the frontier as next', () => {
    expect(nodeState('1', 'home-row-full')).toBe('next');
    expect(nodeState(undefined, 'home-row')).toBe('next');
  });

  it('marks everything beyond the frontier locked', () => {
    expect(nodeState('1', 'top-common')).toBe('locked');
    expect(nodeState(undefined, 'rhythm')).toBe('locked');
  });

  it('gives exactly one next node, so the ladder cannot point two ways', () => {
    for (const progress of ['', '1', '31', '3120', '111111111111']) {
      const nexts = MODULE_IDS.filter((id) => nodeState(progress, id) === 'next');
      expect(nexts.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('the alphabet a boss may use', () => {
  it('is cumulative, so a later boss keeps the keys you already know', () => {
    const first = taughtBy('home-row');
    const second = taughtBy('home-row-full');
    for (const key of first) expect(second).toContain(key);
    expect(second).toContain('g');
    expect(first).not.toContain('g');
  });

  it('never shrinks as the path is walked', () => {
    let previous = 0;
    for (const id of MODULE_IDS) {
      const size = taughtBy(id).length;
      expect(size).toBeGreaterThanOrEqual(previous);
      previous = size;
    }
  });

  /** Every boss line is words with gaps between them. */
  it('always includes the space', () => {
    for (const id of MODULE_IDS) expect(taughtBy(id)).toContain(' ');
  });

  it('opens on the home row and nothing else', () => {
    expect([...taughtBy('home-row')].sort().join('')).toBe([...' asdfjkl;'].sort().join(''));
  });

  it('returns nothing for a module it does not know', () => {
    // @ts-expect-error deliberately outside the union, as untrusted input is.
    expect(taughtBy('not-a-module')).toBe('');
  });
});
