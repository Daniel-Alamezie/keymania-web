import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bestSnapshot, clearBest, recordStreak } from '../warmupBest';

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
  clearBest();
});

describe('an untouched browser', () => {
  it('has no streak to beat', () => {
    expect(bestSnapshot()).toBe(0);
  });
});

describe('keeping a streak', () => {
  it('remembers one, and says it was a best', () => {
    expect(recordStreak(14)).toBe(true);
    expect(bestSnapshot()).toBe(14);
  });

  it('keeps the longer of two, whichever order they arrive in', () => {
    recordStreak(30);
    expect(recordStreak(12)).toBe(false);
    expect(bestSnapshot()).toBe(30);
  });

  it('does not count equalling it as beating it', () => {
    recordStreak(20);
    expect(recordStreak(20)).toBe(false);
  });

  it('ignores a streak that is not a number', () => {
    recordStreak(10);
    expect(recordStreak(Number.NaN)).toBe(false);
    expect(bestSnapshot()).toBe(10);
  });

  it('ignores nothing typed at all', () => {
    expect(recordStreak(0)).toBe(false);
    expect(bestSnapshot()).toBe(0);
  });
});

describe('storage being unavailable', () => {
  /**
   * Private browsing, or a locked-down browser. The session must still run:
   * only the remembering is lost, which is the least important half of it.
   */
  it('does not throw when the write is refused', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('denied'); },
        removeItem: () => {},
      } as unknown as Storage,
    });
    clearBest();
    expect(() => recordStreak(9)).not.toThrow();
  });
});
