import { beforeEach, describe, expect, it } from 'vitest';

/**
 * A two-method localStorage on a stub window, because this suite runs in plain
 * Node. Same trick `seenCosmetics.test.ts` uses, reaching one level further:
 * `typingTest` goes through `window.localStorage`, as its sibling
 * `warmupBest` does, rather than the bare global.
 *
 * Safe at module scope even though imports are hoisted, because nothing in
 * `typingTest` touches storage until a function is called.
 */
const store = new Map<string, string>();
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  },
};

import {
  bestAt, bestOverall, clearTests, isTestSeconds, recordTest,
  TEST_SECONDS, testAccuracy, testWpm,
} from '../typingTest';
import { survivalWpm } from '../survivalReducer';
import type { SurvivalState } from '../survivalReducer';

/**
 * The typing test's arithmetic and its record.
 *
 * The first block matters more than the rest: this screen exists to answer
 * "how fast do I type", and the game already answers that question in three
 * other places. An answer here that disagreed with those would be worse than
 * no answer at all, because a player would believe whichever number was
 * kindest.
 */

describe('testWpm', () => {
  /**
   * Pinned against `survivalWpm` itself rather than against a number copied
   * out of it. A test that restates the formula passes when the formula is
   * changed in one place and not the other, which is the only failure worth
   * catching here.
   */
  it('agrees with the speed the rest of the game reports', () => {
    const state = (chars: number): SurvivalState =>
      ({ startedAt: 0, charsTyped: chars } as SurvivalState);

    for (const [chars, seconds] of [[300, 60], [150, 30], [400, 45], [37, 30]]) {
      expect(testWpm(chars, seconds), `${chars} chars in ${seconds}s`)
        .toBe(survivalWpm(state(chars), seconds * 1000));
    }
  });

  it('uses the standard five-character word', () => {
    // 300 correct characters in a minute is 60 words by the usual definition.
    expect(testWpm(300, 60)).toBe(60);
    // The same typing in half the time is twice the speed.
    expect(testWpm(300, 30)).toBe(120);
  });

  it('scales the shorter tests up to a per-minute figure', () => {
    // 150 chars in 30s is 30 words in half a minute, so 60 wpm.
    expect(testWpm(150, 30)).toBe(60);
    expect(testWpm(225, 45)).toBe(60);
  });

  it('is zero for a test nobody typed in, rather than a division by nothing', () => {
    expect(testWpm(0, 30)).toBe(0);
    expect(testWpm(100, 0)).toBe(0);
    expect(testWpm(Number.NaN, 30)).toBe(0);
    expect(testWpm(100, Number.NaN)).toBe(0);
    expect(testWpm(-40, 30)).toBe(0);
  });
});

describe('testAccuracy', () => {
  it('reports the share of keystrokes that landed', () => {
    expect(testAccuracy(90, 10)).toBe(100 - 10);
    expect(testAccuracy(1, 1)).toBe(50);
  });

  /** Opening a result card on 0% would be false and unkind at once. */
  it('is 100 for a test nobody typed in, not 0', () => {
    expect(testAccuracy(0, 0)).toBe(100);
  });
});

describe('the record', () => {
  beforeEach(() => clearTests());

  it('keeps a first result at each length', () => {
    expect(recordTest(30, 61)).toBe(true);
    expect(bestAt(30)).toBe(61);
  });

  it('keeps a faster result and refuses a slower one', () => {
    recordTest(60, 70);
    expect(recordTest(60, 82)).toBe(true);
    expect(bestAt(60)).toBe(82);
    expect(recordTest(60, 81)).toBe(false);
    expect(bestAt(60)).toBe(82);
  });

  /** Equalling is not beating, and must not claim to be. */
  it('does not call an identical result a new best', () => {
    recordTest(45, 55);
    expect(recordTest(45, 55)).toBe(false);
  });

  /**
   * The reason the record is keyed by length at all. Two tests of different
   * durations are different tests, and a thirty second sprint will always
   * flatter a sixty second one.
   */
  it('keeps each length apart, so a short burst cannot overwrite a long run', () => {
    recordTest(30, 95);
    recordTest(60, 71);
    expect(bestAt(30)).toBe(95);
    expect(bestAt(60)).toBe(71);
    expect(bestAt(45)).toBe(0);
  });

  it('reports nothing for a length never run', () => {
    expect(bestAt(45)).toBe(0);
    expect(bestOverall()).toBe(0);
  });

  it('reports the fastest across every length for the door', () => {
    recordTest(30, 88);
    recordTest(60, 64);
    expect(bestOverall()).toBe(88);
  });

  it('refuses a result that is not a number, rather than storing one', () => {
    expect(recordTest(30, Number.NaN)).toBe(false);
    expect(recordTest(30, 0)).toBe(false);
    expect(recordTest(30, -5)).toBe(false);
    expect(bestAt(30)).toBe(0);
  });

  /**
   * Storage a player can edit by hand. A junk entry must read as "no record"
   * rather than rendering as a personal best of NaN on a card whose entire
   * job is to state a number.
   */
  it('ignores a stored value that is not a sane speed', () => {
    // Written straight into storage, then the cache dropped, so the next read
    // genuinely parses it rather than answering from memory.
    store.set(
      'keymania.typingtest.best.v1',
      JSON.stringify({ 30: 'fast', 45: -3, 60: 70, 90: 200 }),
    );
    expect(bestAt(30)).toBe(0);
    expect(bestAt(45)).toBe(0);
    expect(bestAt(60)).toBe(70);
    // 90 is not a length this game offers, so it is not a record of anything.
    expect(bestOverall()).toBe(70);
  });
});

describe('the lengths on offer', () => {
  it('is the closed set the screen draws buttons from', () => {
    expect([...TEST_SECONDS]).toEqual([30, 45, 60]);
  });

  it('recognises only those, so a stored key cannot invent a fourth', () => {
    for (const seconds of TEST_SECONDS) expect(isTestSeconds(seconds)).toBe(true);
    for (const junk of [0, 15, 90, -30, Number.NaN, '30', null, undefined]) {
      expect(isTestSeconds(junk), String(junk)).toBe(false);
    }
  });
});
