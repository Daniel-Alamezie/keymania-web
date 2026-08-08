import { describe, expect, it } from 'vitest';
import { seasonFor, sentenceFor } from '../sentences';

/**
 * The client half of the weekly season.
 *
 * The mechanism's full contract lives in the API's seasonalWords test; this
 * mirrors only what the practice modes depend on. The one rule repeated here
 * because it must never diverge: a season is a weighting, never an exclusion,
 * or the word-repetition complaint the banks were expanded for comes back to
 * the warm-up first.
 */

describe('the client season', () => {
  it('is deterministic per week and moves between weeks', () => {
    expect(seasonFor('2026-W33')).toEqual(seasonFor('2026-W33'));
    expect(seasonFor('2026-W33').nouns).not.toEqual(seasonFor('2026-W34').nouns);
  });

  it('keeps eight signature lines live and rotates them', () => {
    expect(seasonFor('2026-W33').signature).toHaveLength(8);
    const union = new Set(
      ['2026-W33', '2026-W34', '2026-W35', '2026-W36']
        .flatMap((w) => seasonFor(w).signature),
    );
    expect(union.size).toBeGreaterThan(8);
  });

  it('leaves the full vocabulary reachable inside one week', () => {
    const words = new Set<string>();
    for (let i = 0; i < 3_000; i += 1) {
      for (const word of sentenceFor('2026-W33').split(' ')) words.add(word);
    }
    // The same floor the API pins: weighting, not exclusion.
    expect(words.size).toBeGreaterThan(380);
  });

  it('still refuses to repeat the excluded sentence', () => {
    // The guarantee randomSentence has always made, held under a fixed week:
    // the fallback pool is now the week's live lines, and it must still
    // always have something different to return.
    const live = seasonFor('2026-W33').signature;
    for (const line of live) {
      for (let i = 0; i < 50; i += 1) {
        expect(sentenceFor('2026-W33', `${line} `)).not.toBe(line);
      }
    }
  });

  it('produces only typeable sentences under a season', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(sentenceFor('2026-W35')).toMatch(/^[a-z]+( [a-z]+)*$/);
    }
  });
});
