import { afterEach, describe, expect, it, vi } from 'vitest';
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

/**
 * Exclusion, at the seam where it actually broke.
 *
 * The duel's sentences carry a committing trailing space; the corpus's do not.
 * `randomSentence('…fast one ')` therefore compared unequal strings and never
 * rejected anything — the same sentence could roll in twice in a row, rarely
 * enough that it survived until a reducer test happened to hit the repeat.
 * These pin the fix deterministically by forcing the RNG against it, instead
 * of waiting for luck.
 */
describe('excluding the previous sentence', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects the excluded sentence even when it arrives with its trailing space', () => {
    // Math.random at 0 forces the signature branch and index 0 on every draw,
    // so every candidate is the excluded sentence — the worst possible luck.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const first = randomSentence();

    expect(randomSentence(`${first} `)).not.toBe(first);
  });

  it('guarantees a different sentence, not merely a likely one', () => {
    /**
     * 0.5, not 0, and the choice is the test. At 0 every draw takes the
     * signature branch, and the old unguarded fallback — a template pick —
     * happened to differ anyway, so the first version of this test passed
     * against the very bug it was written for. At 0.5 every draw builds the
     * same template sentence, the fallback rebuilds it identically, and only
     * a fallback that genuinely guarantees difference can pass.
     */
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const stuck = randomSentence();

    for (let i = 0; i < 20; i++) {
      expect(randomSentence(stuck)).not.toBe(stuck);
    }
  });
});
