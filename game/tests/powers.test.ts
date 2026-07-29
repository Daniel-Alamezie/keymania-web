import { describe, expect, it } from 'vitest';
import {
  chargeScript, chargeSentence, HELD_POWERS, POWER_META, POWERS,
} from '../powers';

/**
 * Charged words.
 *
 * These exist because this has already gone wrong once in a way nothing else
 * would have caught: the charge window is nine words, but solo play rolls one
 * sentence at a time and a sentence is shorter than that — so the window never
 * completed and no word was ever charged. Nothing crashed, nothing logged, the
 * feature was simply absent. The first test below is that bug.
 */

const SHORT_SENTENCE = 'the quiet blade guards a hollow tower';   // 7 words
const RUNS = 400;

/** chargeScript is random by design, so behaviour is asserted over many runs. */
function chargedOver(script: string[], runs = RUNS): Record<number, string>[] {
  return Array.from({ length: runs }, () => chargeScript(script));
}

describe('chargeScript', () => {
  it('charges sentences shorter than the charge window', () => {
    const everCharged = chargedOver([SHORT_SENTENCE])
      .some((result) => Object.keys(result).length > 0);

    expect(everCharged).toBe(true);
  });

  it('charges a short sentence often enough to be noticed', () => {
    // A power that appears once in fifty duels may as well not exist.
    const hitRate = chargedOver([SHORT_SENTENCE])
      .filter((result) => Object.keys(result).length > 0).length / RUNS;

    expect(hitRate).toBeGreaterThan(0.4);
  });

  it('never charges a word shorter than the minimum', () => {
    // 'a' and 'of' are in reach of the window but must never be picked: a
    // two-letter charged word is a free power, not a risk worth taking.
    const script = ['a bright lantern guards the ancient gate of stone'];
    const words = script[0].split(' ');

    for (const result of chargedOver(script)) {
      for (const index of Object.keys(result)) {
        expect(words[Number(index)].length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('only ever names words that exist in the script', () => {
    const script = ['silver hands carry a frozen crown', 'the restless river opens every gate'];
    const total = script.flatMap((s) => s.split(' ')).length;

    for (const result of chargedOver(script)) {
      for (const index of Object.keys(result)) {
        expect(Number(index)).toBeGreaterThanOrEqual(0);
        expect(Number(index)).toBeLessThan(total);
      }
    }
  });

  it('only grants known powers', () => {
    for (const result of chargedOver([SHORT_SENTENCE])) {
      for (const power of Object.values(result)) {
        expect(POWERS).toContain(power);
      }
    }
  });

  it('charges roughly one word in nine across a long script', () => {
    // Too many and every duel is a firework display; too few and the mechanic
    // is invisible. This pins the rate loosely enough to survive randomness.
    const sentence = 'the ancient tower guards a frozen river beyond the hidden valley';
    const script = Array.from({ length: 12 }, () => sentence);
    const total = script.flatMap((s) => s.split(' ')).length;

    const rates = chargedOver(script, 60)
      .map((result) => Object.keys(result).length / total);
    const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;

    expect(mean).toBeGreaterThan(1 / 20);
    expect(mean).toBeLessThan(1 / 5);
  });

  it('returns nothing when no word is long enough', () => {
    expect(chargeScript(['a an of the to it is'])).toEqual({});
  });

  it('copes with an empty script', () => {
    expect(chargeScript([])).toEqual({});
  });
});

describe('chargeSentence', () => {
  it('keys powers by position within the single sentence', () => {
    const sentence = 'the ancient tower guards a frozen river';
    const words = sentence.split(' ');

    for (let run = 0; run < RUNS; run++) {
      for (const index of Object.keys(chargeSentence(sentence))) {
        expect(Number(index)).toBeLessThan(words.length);
      }
    }
  });
});

/**
 * The power roster, pinned on this side of the wire.
 *
 * The server decides which words are charged and with what; this side draws the
 * result. Neither can see the other's list, so the two are a contract held
 * together by nothing but agreement — the same arrangement as characters and
 * bot difficulties, pinned the same way.
 *
 * A mismatch fails quietly, which is what earns it a test: the server charges a
 * word with a power this side has no entry for, `POWER_META[kind]` comes back
 * undefined, and a charged word renders as a blank rather than a colour.
 */
describe('the power roster', () => {
  it('is the three keymania-api ships', () => {
    expect([...POWERS]).toEqual(['ward', 'surge', 'mend']);
  });

  /**
   * The check that makes adding a power safe.
   *
   * `POWER_META` is a `Record<PowerKind, …>`, so a missing entry is a compile
   * error rather than a runtime blank — but only if every kind is really in
   * the table. This asserts the pair have not been allowed to disagree.
   */
  it('describes every power it lists', () => {
    for (const kind of POWERS) {
      const meta = POWER_META[kind];
      expect(meta, kind).toBeDefined();
      expect(meta.label.length, kind).toBeGreaterThan(0);
      expect(meta.tint, kind).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.sprite, kind).toBe(`power-${kind}`);
    }
  });

  /**
   * Held powers are the ones the HUD has a slot for. An instant power has
   * nothing to draw — by the time you could look at it, it has happened.
   */
  it('only marks as held the powers that persist', () => {
    for (const kind of HELD_POWERS) expect(POWERS).toContain(kind);
    expect(HELD_POWERS).not.toContain('mend');
  });
});
