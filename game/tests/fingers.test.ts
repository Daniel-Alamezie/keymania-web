import { describe, expect, it } from 'vitest';
import { fingerFor, fingerLabel, shiftHandFor } from '../fingers';
import { MODULE_IDS, taughtBy } from '../learnPath';

describe('the home keys', () => {
  it.each([
    ['a', 'left', 'pinky'], ['s', 'left', 'ring'], ['d', 'left', 'middle'], ['f', 'left', 'index'],
    ['j', 'right', 'index'], ['k', 'right', 'middle'], ['l', 'right', 'ring'],
    [';', 'right', 'pinky'],
  ])('%s belongs to the %s %s', (key, hand, finger) => {
    expect(fingerFor(key)).toMatchObject({ hand, finger });
  });

  it('sends every finger back to a home key it can find again', () => {
    for (const key of 'asdfjkl;') expect(fingerFor(key)!.home).toBe(key);
  });
});

describe('the reaches', () => {
  /** The only two fingers that cover a second column. */
  it('gives the middle columns to the index fingers', () => {
    for (const key of 'tgb') expect(fingerFor(key)).toMatchObject({ hand: 'left', finger: 'index' });
    for (const key of 'yhn') expect(fingerFor(key)).toMatchObject({ hand: 'right', finger: 'index' });
  });

  it('keeps every other finger on one column', () => {
    for (const key of 'qaz') expect(fingerFor(key)).toMatchObject({ finger: 'pinky', hand: 'left' });
    for (const key of 'wsx') expect(fingerFor(key)).toMatchObject({ finger: 'ring', hand: 'left' });
    for (const key of 'edc') expect(fingerFor(key)).toMatchObject({ finger: 'middle', hand: 'left' });
    for (const key of 'ol.') expect(fingerFor(key)).toMatchObject({ finger: 'ring', hand: 'right' });
  });

  it('gives the space bar to a thumb', () => {
    expect(fingerFor(' ')).toMatchObject({ finger: 'thumb' });
    expect(fingerLabel(' ')).toBe('either thumb');
  });

  it('knows nothing about a key the curriculum never teaches', () => {
    expect(fingerFor('£')).toBeUndefined();
    expect(fingerLabel('£')).toBeUndefined();
  });
});

/**
 * The coverage guarantee. A lesson can only teach the right finger for a key
 * if this map has an opinion about it, and a key taught by the path with no
 * finger behind it would be the one place the hint silently goes missing.
 */
describe('coverage of the path', () => {
  it.each(MODULE_IDS)('every key %s teaches has a finger', (id) => {
    for (const key of taughtBy(id)) {
      expect(fingerFor(key), `no finger owns "${key}"`).toBeDefined();
    }
  });

  it('can name the finger for every key in the whole path', () => {
    for (const key of taughtBy(MODULE_IDS[MODULE_IDS.length - 1])) {
      expect(fingerLabel(key)).toBeTruthy();
    }
  });
});

describe('capitals', () => {
  /** The same finger doing the same reach; only the shift hand is new. */
  it('does not move a letter to a different finger', () => {
    expect(fingerFor('A')).toEqual(fingerFor('a'));
    expect(fingerFor('P')).toEqual(fingerFor('p'));
  });

  /**
   * Module 8's whole lesson. Shifting with the hand that types the letter is
   * the commonest self-taught habit and it caps somebody's speed permanently.
   */
  it('shifts with the opposite hand', () => {
    expect(shiftHandFor('A')).toBe('right');
    expect(shiftHandFor('P')).toBe('left');
  });

  it('has nothing to say about a lower-case letter or a digit', () => {
    expect(shiftHandFor('a')).toBeUndefined();
    expect(shiftHandFor('4')).toBeUndefined();
    expect(shiftHandFor(' ')).toBeUndefined();
  });
});
