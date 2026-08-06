import { describe, expect, it } from 'vitest';
import { MODULE_IDS } from '../learnPath';
import { CURRICULUM } from '../curriculum';
import {
  BOARDS, BOARD_W, LAYOUT_IDS, boardOf, capFor, isUniversal, needsShift, type LayoutId,
} from '../keyboard';
import { fingerFor, fingerLabel, shiftHandFor } from '../fingers';
import { shiftReach } from '../hands';

/**
 * Shift, as one answer rather than several, on every board we ship.
 *
 * This codebase has now had the same defect three times: a rule implemented
 * twice, both copies correct on the case somebody tested, disagreeing on the
 * case nobody did. `keyFor` was one. `shiftHandFor` against `shiftReach` was
 * the next. Adding a second board multiplies every one of those chances, so
 * every assertion here runs for every layout rather than for the one the
 * author happened to be sitting at.
 */

const shiftedOf = (layout: LayoutId) => Object.keys(boardOf(layout).shifted);

describe.each(LAYOUT_IDS)('the %s board', (layout) => {
  const ALL_SHIFTED = shiftedOf(layout);

  it('is fifteen units wide on every row', () => {
    const widest = new Map<number, number>();
    for (const cap of boardOf(layout).caps) {
      const right = cap.x + (cap.w ?? 1);
      widest.set(cap.y, Math.max(widest.get(cap.y) ?? 0, right));
    }
    /* The ISO Enter covers the tail of the row beneath it, so that row's own
       keys stop short by design. Every row still reaches the full width once
       the tall key is counted. */
    const covered = boardOf(layout).caps
      .filter((cap) => (cap.h ?? 1) > 1)
      .map((cap) => cap.y + (cap.h ?? 1) - 1);
    for (const [row, right] of widest) {
      if (covered.includes(row)) continue;
      expect(right, `row ${row}`).toBe(BOARD_W);
    }
  });

  it('gives every typable key a finger', () => {
    for (const cap of boardOf(layout).caps) {
      if (!cap.char) continue;
      expect(fingerFor(cap.char, layout), `no finger owns ${cap.label}`).toBeDefined();
    }
  });

  it('gives every shifted character a finger, the same one as the key beneath it', () => {
    for (const [shifted, base] of Object.entries(boardOf(layout).shifted)) {
      expect(fingerFor(shifted, layout), `no finger owns ${shifted}`).toBeDefined();
      expect(fingerFor(shifted, layout), `${shifted} vs ${base}`).toEqual(fingerFor(base, layout));
      expect(capFor(shifted, layout)).toBe(capFor(base, layout));
    }
  });

  it('names a shift hand for every shifted character, never the typing hand', () => {
    for (const char of ALL_SHIFTED) {
      const hand = shiftHandFor(char, layout);
      expect(hand, `no shift hand for ${char}`).toBeDefined();
      expect(needsShift(char, layout), char).toBe(true);
      expect(hand).not.toBe(fingerFor(char, layout)!.hand);
    }
  });

  /* The seam: `shiftReach` draws it and `shiftHandFor` says it. The bug was
     that they were two opinions rather than one fact. */
  it('draws the shift it speaks', () => {
    for (const char of [...ALL_SHIFTED, 'A', 'P', 'f', 'j', ' ', '4']) {
      expect(shiftReach(char, layout)?.hand, char).toBe(shiftHandFor(char, layout));
    }
    for (const char of ALL_SHIFTED) {
      expect(shiftReach(char, layout)!.finger).toBe('pinky');
    }
  });

  it('names no shift for a character that needs none', () => {
    for (const char of ['a', 'f', 'j', ';', '4', ' ']) {
      expect(shiftHandFor(char, layout), char).toBeUndefined();
      expect(shiftReach(char, layout), char).toBeUndefined();
    }
  });

  it('keeps the home row where the hands expect it', () => {
    for (const char of 'asdfjkl;') {
      expect(capFor(char, layout), `${char} missing`).toBeDefined();
      expect(fingerFor(char, layout)!.home, char).toBe(char);
    }
  });
});

/**
 * What the second board was built for.
 *
 * These are the differences that made a single hard-coded board actively
 * teach the wrong finger, spelled out so that a later edit to either board
 * has to face them.
 */
describe('US against UK', () => {
  it('agrees about every letter and digit, which is why the curriculum survives', () => {
    for (const char of 'abcdefghijklmnopqrstuvwxyz0123456789') {
      expect(fingerFor(char, 'us'), char).toEqual(fingerFor(char, 'uk'));
      expect(capFor(char, 'us')!.x, char).toBe(capFor(char, 'uk')!.x);
    }
  });

  it('disagrees about the double quote, which is the bug that started this', () => {
    expect(capFor('"', 'us')!.label).toBe("'");
    expect(capFor('"', 'uk')!.label).toBe('2');
    expect(fingerLabel('"', 'us')).toBe('right little finger');
    expect(fingerLabel('"', 'uk')).toBe('left ring finger');
    /* And therefore the other hand holds shift. */
    expect(shiftHandFor('"', 'us')).toBe('left');
    expect(shiftHandFor('"', 'uk')).toBe('right');
  });

  it('swaps the at sign with it', () => {
    expect(capFor('@', 'us')!.label).toBe('2');
    expect(capFor('@', 'uk')!.label).toBe("'");
  });

  it('has a pound sign on UK only, and a tilde in a different place', () => {
    expect(capFor('£', 'uk')!.label).toBe('3');
    expect(capFor('£', 'us')).toBeUndefined();
    expect(capFor('~', 'us')!.label).toBe('`');
    expect(capFor('~', 'uk')!.label).toBe('#');
  });

  it('moves the backslash across the board, and with it the hand', () => {
    expect(fingerFor('\\', 'us')!.hand).toBe('right');
    expect(fingerFor('\\', 'uk')!.hand).toBe('left');
  });

  it('gives UK a tall Enter and one more typable key', () => {
    const tall = BOARDS.uk.caps.filter((cap) => (cap.h ?? 1) > 1);
    expect(tall).toHaveLength(1);
    expect(tall[0].label).toBe('Enter');
    expect(tall[0].notch).toBeGreaterThan(0);
    expect(BOARDS.us.caps.every((cap) => (cap.h ?? 1) === 1)).toBe(true);

    const typable = (id: LayoutId) => BOARDS[id].caps.filter((cap) => cap.char).length;
    expect(typable('uk')).toBe(typable('us') + 1);
  });
});

/**
 * Driven off the real curriculum, so a lesson added later that uses a
 * character nothing owns fails here rather than in front of a learner.
 */
describe('every character the curriculum asks for', () => {
  const chars = new Set<string>();
  for (const id of MODULE_IDS) {
    for (const lesson of CURRICULUM[id]?.lessons ?? []) {
      for (const line of lesson.script) for (const char of line) chars.add(char);
    }
  }

  it('has characters in it, or this proves nothing', () => {
    expect(chars.size).toBeGreaterThan(20);
  });

  it.each(LAYOUT_IDS)('has a key, a finger and a hint on %s', (layout) => {
    for (const char of chars) {
      expect(capFor(char, layout), `no key for ${JSON.stringify(char)}`).toBeDefined();
      expect(fingerFor(char, layout), `no finger for ${JSON.stringify(char)}`).toBeDefined();
      expect(fingerLabel(char, layout), `no hint for ${JSON.stringify(char)}`).toBeDefined();
    }
  });

  it.each(LAYOUT_IDS)('tells you about shift wherever shift is needed on %s', (layout) => {
    const shifted = [...chars].filter((char) => needsShift(char, layout));
    expect(shifted.length).toBeGreaterThan(0);
    for (const char of shifted) {
      expect(shiftHandFor(char, layout), `${char} never mentions shift`).toBeDefined();
    }
  });

  /**
   * Not an assertion that the curriculum IS universal, because it deliberately
   * is not: module 10 teaches `"`, which moves. This pins which characters
   * move, so that adding another is a decision somebody makes on purpose.
   */
  it('moves in exactly one place, the double quote', () => {
    const moves = [...chars].filter((char) => !isUniversal(char)).sort();
    expect(moves).toEqual(['"']);
  });
});
