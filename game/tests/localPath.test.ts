import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocal, hasLocalProgress, localSnapshot, recordLocal, unsavedModules,
} from '../localPath';
import { MODULE_IDS } from '../learnPath';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() });
  clearLocal();
});

describe('progress without an account', () => {
  it('starts empty', () => {
    expect(localSnapshot()).toBe('');
    expect(hasLocalProgress()).toBe(false);
  });

  it('writes a star at the module position, in the server encoding', () => {
    recordLocal('home-row', 2);
    expect(localSnapshot()).toBe('2');
    expect(hasLocalProgress()).toBe(true);
  });

  it('pads intervening modules rather than shifting everything along', () => {
    recordLocal('top-common', 1);
    expect(localSnapshot()).toBe('001');
  });

  /** The same rule the server keeps: practising must never cost a star. */
  it('keeps the better of two attempts', () => {
    recordLocal('home-row', 3);
    recordLocal('home-row', 1);
    expect(localSnapshot()).toBe('3');
  });

  it('is forgotten once an account has taken it over', () => {
    recordLocal('home-row', 3);
    clearLocal();
    expect(localSnapshot()).toBe('');
  });
});

/**
 * The merge on sign-in. This is the part that makes "sign in to save your
 * progress" true rather than a sentence that loses it.
 */
describe('what an account still owes', () => {
  it('offers everything when the account has nothing', () => {
    recordLocal('home-row', 3);
    recordLocal('home-row-full', 1);
    expect(unsavedModules('')).toEqual([
      { id: 'home-row', stars: 3 },
      { id: 'home-row-full', stars: 1 },
    ]);
  });

  /** Only ever climbs: a better result on the account is never dragged down. */
  it('never offers to lower a star the account already holds', () => {
    recordLocal('home-row', 1);
    expect(unsavedModules('3')).toEqual([]);
  });

  it('offers only the modules that would actually improve', () => {
    recordLocal('home-row', 1);
    recordLocal('home-row-full', 3);
    expect(unsavedModules('30')).toEqual([{ id: 'home-row-full', stars: 3 }]);
  });

  it('has nothing to say when the device learned nothing', () => {
    expect(unsavedModules('333')).toEqual([]);
  });

  it('copes with an account string shorter than the catalogue', () => {
    recordLocal(MODULE_IDS[MODULE_IDS.length - 1], 2);
    expect(unsavedModules('3')).toEqual([
      { id: MODULE_IDS[MODULE_IDS.length - 1], stars: 2 },
    ]);
  });
});
