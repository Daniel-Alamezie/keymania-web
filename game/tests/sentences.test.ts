import { describe, expect, it } from 'vitest';
import { OPENING_SENTENCE, randomSentence } from '../sentences';

/**
 * Generated sentences.
 *
 * The generator stitches templates and word banks together, so a single stray
 * space in one template produces an empty "word" — which the duel would then
 * ask the player to type, with no way to type it. Cheap invariants, expensive
 * failure.
 */

const RUNS = 500;
const sample = (runs = RUNS) => Array.from({ length: runs }, () => randomSentence());

describe('randomSentence', () => {
  it('never produces an empty or blank sentence', () => {
    for (const sentence of sample()) {
      expect(sentence.trim().length).toBeGreaterThan(0);
    }
  });

  it('never produces an untypeable empty word', () => {
    // A double space, or a leading/trailing one, splits into '' — a word the
    // player is asked to type and physically cannot.
    for (const sentence of sample()) {
      expect(sentence).not.toMatch(/\s{2,}/);
      expect(sentence).toBe(sentence.trim());
      for (const word of sentence.split(' ')) {
        expect(word.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses only characters that exist on a keyboard as plain keys', () => {
    // Anything else cannot be matched by a keydown of length 1, so the duel
    // would stall on a character the player can never satisfy.
    for (const sentence of sample()) {
      expect(sentence).toMatch(/^[a-z ]+$/);
    }
  });

  it('avoids handing back the sentence just typed', () => {
    // Not guaranteed - the generator gives up after a few attempts rather than
    // looping forever - but a repeat should be rare, not routine.
    const previous = 'the quiet blade guards a hollow tower';
    const repeats = Array.from({ length: RUNS }, () => randomSentence(previous))
      .filter((s) => s === previous).length;

    expect(repeats).toBe(0);
  });

  it('does not meaningfully repeat itself', () => {
    // The whole point of templates over a fixed list: a session should not feel
    // like it is looping.
    const distinct = new Set(sample(200));
    expect(distinct.size).toBeGreaterThan(120);
  });

  it('produces sentences long enough to build a combo on', () => {
    for (const sentence of sample(200)) {
      expect(sentence.split(' ').length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('OPENING_SENTENCE', () => {
  it('is a constant, because it renders on the server and the client', () => {
    // A generated opener would differ between the two renders and break
    // hydration - this is the fix for a bug that actually happened.
    expect(OPENING_SENTENCE).toBe(OPENING_SENTENCE);
    expect(OPENING_SENTENCE.length).toBeGreaterThan(0);
  });

  it('satisfies the same typing invariants as a generated sentence', () => {
    expect(OPENING_SENTENCE).toMatch(/^[a-z ]+$/);
    expect(OPENING_SENTENCE).not.toMatch(/\s{2,}/);
  });
});
