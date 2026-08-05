import { describe, expect, it } from 'vitest';
import { noticeHeading, noticeLine } from '../../models/challengeNotice';
import type { Cosmetic } from '../../models/cosmetics';
import type { ChallengeProgress } from '../../models/profile';

/**
 * The toast's copy.
 *
 * Tested because it is the part players actually complained about: the first
 * version said "A new challenge is in" over a bare "Keep a 5-day streak", and
 * the report was that it did not read like English. What follows pins the
 * three things that fixes — full sentences, correct plurals, and the reward
 * named — so a later edit cannot quietly undo any of them.
 */

const challenge = (over: Partial<ChallengeProgress> = {}): ChallengeProgress => ({
  id: 'streak-five',
  title: 'Keep a 5-day streak',
  reward: { kind: 'cosmetic', cosmetic: 'badge.backpack' },
  progress: 1,
  goal: 5,
  display: 'count',
  done: false,
  ...over,
});

const catalogue: Cosmetic[] = [
  { id: 'badge.backpack', kind: 'badge', label: 'Wayfarer', hint: 'Keep a 5-day streak' },
];

describe('noticeHeading', () => {
  it('is a complete sentence, and ends in a full stop', () => {
    expect(noticeHeading(1)).toBe('A new challenge has arrived.');
    // The specific complaint: the old copy was a fragment with no punctuation.
    expect(noticeHeading(1).endsWith('.')).toBe(true);
    expect(noticeHeading(4).endsWith('.')).toBe(true);
  });

  it('agrees with its own number', () => {
    expect(noticeHeading(1)).toContain('challenge has');
    expect(noticeHeading(2)).toBe('2 new challenges have arrived.');
    expect(noticeHeading(11)).toBe('11 new challenges have arrived.');
  });

  it('never says "is in"', () => {
    // The reported phrasing. Newsroom shorthand, not something a person says.
    for (const n of [1, 2, 7]) expect(noticeHeading(n)).not.toMatch(/\bis in\b|\bare in\b/);
  });
});

describe('noticeLine', () => {
  /**
   * The half that was missing entirely: a notice that names an obligation and
   * not the reward is asking for a favour.
   */
  it('says what the challenge asks and what it pays', () => {
    expect(noticeLine(challenge(), catalogue))
      .toBe('Keep a 5-day streak to unlock Wayfarer.');
  });

  it('resolves a character reward without needing the catalogue', () => {
    const line = noticeLine(challenge({ reward: { kind: 'character', character: 'wanderer' } }), []);
    // The roster ships with the client, so this works even when the profile's
    // catalogue is empty.
    expect(line).toMatch(/^Win|^Keep/);
    expect(line).toContain('to unlock Wanderer.');
  });

  /**
   * A real case, not a defensive one: a toast rendered from a cached record
   * can hold a cosmetic id this build has no entry for. A shorter true
   * sentence beats "to unlock undefined".
   */
  it('falls back to the ask alone when the reward cannot be named', () => {
    expect(noticeLine(challenge(), [])).toBe('Keep a 5-day streak.');
    expect(noticeLine(challenge(), undefined)).toBe('Keep a 5-day streak.');
  });

  it('always ends in a full stop, whichever branch it took', () => {
    for (const cat of [catalogue, [], undefined]) {
      expect(noticeLine(challenge(), cat)!.endsWith('.')).toBe(true);
    }
  });

  it('says nothing at all rather than an empty sentence', () => {
    // Reachable if the fresh id is not in the current list, which the caller
    // does not guarantee.
    expect(noticeLine(undefined, catalogue)).toBeNull();
  });

  /**
   * No em dash, anywhere in player-facing copy. A house rule, and this is the
   * newest piece of copy in the app.
   */
  it('uses plain punctuation', () => {
    expect(noticeLine(challenge(), catalogue)).not.toContain('—');
    expect(noticeHeading(3)).not.toContain('—');
  });
});
