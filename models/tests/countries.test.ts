import { describe, expect, it } from 'vitest';
import { asCountry, COUNTRY_CODES, countryName, countryOptions } from '../countries';

/**
 * Country codes.
 *
 * `asCountry` is the one that matters: it guards what reaches storage, and a
 * code that gets past it does not merely render badly — it becomes a partition
 * key in the country index, creating a country that does not exist and a board
 * nobody can ever be ranked against.
 */

describe('asCountry', () => {
  it('accepts a real code', () => {
    expect(asCountry('GB')).toBe('GB');
    expect(asCountry('NG')).toBe('NG');
  });

  it('accepts lower case', () => {
    // The code is the identity; its case is formatting. A hand-written request
    // or an older client sending `gb` means Great Britain either way.
    expect(asCountry('gb')).toBe('GB');
    expect(asCountry('Us')).toBe('US');
  });

  it('trims surrounding space', () => {
    expect(asCountry('  FR  ')).toBe('FR');
  });

  describe('refuses anything else', () => {
    it.each([
      ['an invented code', 'ZZ'],
      ['a three-letter code', 'GBR'],
      ['a single letter', 'G'],
      ['empty', ''],
      ['whitespace', '   '],
      ['a country name', 'United Kingdom'],
      ['a partition-key injection', 'ALL'],
    ])('%s', (_label, value) => {
      expect(asCountry(value)).toBeUndefined();
    });

    it.each([
      ['a number', 42],
      ['null', null],
      ['undefined', undefined],
      ['an object', { code: 'GB' }],
      ['an array', ['GB']],
    ])('%s', (_label, value) => {
      expect(asCountry(value)).toBeUndefined();
    });
  });

  it('refuses the board partition key in particular', () => {
    /**
     * `ALL` is the constant the global standings index partitions on. It is not
     * a country code, so this passes for free today — but a future shortcut
     * that shared one index between the global and country boards would make
     * this the difference between a country board and the entire playerbase.
     */
    expect(asCountry('ALL')).toBeUndefined();
    expect(COUNTRY_CODES as readonly string[]).not.toContain('ALL');
  });
});

describe('the code list', () => {
  it('has no duplicates', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('is entirely two upper-case letters', () => {
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  it('covers the obvious ones', () => {
    // A smoke test against a list edited by hand. Losing a row silently is
    // exactly the failure a 250-entry literal invites.
    for (const code of ['GB', 'US', 'NG', 'IN', 'BR', 'JP', 'DE', 'FR', 'AU', 'ZA']) {
      expect(COUNTRY_CODES as readonly string[]).toContain(code);
    }
  });

  it('is sorted, so a hand edit lands where it is looked for', () => {
    expect([...COUNTRY_CODES]).toEqual([...COUNTRY_CODES].sort());
  });
});

describe('countryName', () => {
  it('names a code', () => {
    // Asserted loosely on purpose: the exact string comes from the runtime's
    // own locale data and pinning it would make this a test of ICU's spelling.
    expect(countryName('GB').length).toBeGreaterThan(2);
    expect(countryName('JP')).toMatch(/Japan/i);
  });

  it('falls back to the code rather than to nothing', () => {
    /**
     * Reachable for a record written before `asCountry` existed. The fallback
     * is the code itself, which is what the chip already shows — so the failure
     * degrades to "the tooltip repeats the chip" rather than "the tooltip says
     * undefined".
     */
    expect(countryName('ZZ')).toBe('ZZ');
    expect(countryName('')).toBe('');
  });

  it('never throws, whatever it is handed', () => {
    // `Intl.DisplayNames.of` throws on a structurally invalid code rather than
    // returning undefined, and this is called while rendering a board row.
    expect(() => countryName('!!')).not.toThrow();
    expect(() => countryName('a')).not.toThrow();
  });
});

describe('countryOptions', () => {
  it('offers every country', () => {
    expect(countryOptions()).toHaveLength(COUNTRY_CODES.length);
  });

  it('sorts by name, not by code', () => {
    /**
     * A dropdown ordered AD, AE, AF is ordered by a fact the reader cannot see.
     * Afghanistan sorts before Albania by name; by code AL comes first.
     */
    const names = countryOptions().map((o) => o.name);
    expect([...names]).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('returns the same list each time rather than rebuilding it', () => {
    expect(countryOptions()).toBe(countryOptions());
  });
});
