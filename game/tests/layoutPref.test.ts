import { describe, expect, it } from 'vitest';
import { resolveLayout } from '../layoutPref';

/**
 * Which answer wins, when more than one source has an opinion.
 *
 * The order is the whole design here, and it is deliberately not the obvious
 * one: **a keyboard layout describes the machine, not the person.** Ranking
 * the saved account preference above live detection would hand a UK board to
 * somebody who set UK on their laptop and then sat down at a US desktop, which
 * is precisely the failure this feature exists to prevent.
 */

describe('with nothing known', () => {
  it('falls back to US', () => {
    expect(resolveLayout(undefined, undefined, undefined)).toBe('us');
  });
});

describe('an explicit choice on this machine', () => {
  it('beats detection, because the person is looking at the keyboard', () => {
    expect(resolveLayout('us', 'uk', undefined)).toBe('us');
  });

  it('beats the account', () => {
    expect(resolveLayout('uk', undefined, 'us')).toBe('uk');
  });

  it('beats both at once', () => {
    expect(resolveLayout('uk', 'us', 'us')).toBe('uk');
  });
});

describe('detection', () => {
  it('is used when nothing has been chosen here', () => {
    expect(resolveLayout(undefined, 'uk', undefined)).toBe('uk');
  });

  /**
   * The case the ordering exists for: a UK player's account says UK, but the
   * machine they are sitting at reports a US board. The hardware wins.
   */
  it('beats the account, because it describes this machine', () => {
    expect(resolveLayout(undefined, 'us', 'uk')).toBe('us');
  });
});

describe('the account', () => {
  /**
   * Firefox and Safari implement no layout API at all, so for a large share of
   * players this is the only signal better than a guess.
   */
  it('is used where detection cannot answer', () => {
    expect(resolveLayout(undefined, undefined, 'uk')).toBe('uk');
  });
});
