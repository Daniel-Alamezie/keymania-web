/**
 * Countries, as two-letter codes and nothing else.
 *
 * **No names are stored here, and that is the point.** `Intl.DisplayNames` is
 * built into every browser this game runs in, so the name for a code comes from
 * data the reader's device already has — localised to their own language, for
 * free, with no list to maintain and no translation to go stale. Shipping 250
 * English names would have been about 4KB to say something worse.
 *
 * **No flag images either.** Two independent reasons, and either alone would
 * decide it:
 *
 *   * Emoji flags do not render on Windows. There are no regional-indicator
 *     glyphs in any shipped Windows font, so `🇬🇧` displays as the letters "GB"
 *     — for a large share of players the "flag" was always going to be a code,
 *     and it is better to choose that deliberately than to discover it.
 *   * A board row is eighteen pixels tall. At that size most national flags are
 *     indistinguishable smudges, and the ones that survive do so by being three
 *     coloured bars. A code is legible at any size and is set in the same pixel
 *     font as everything around it.
 *
 * So the code *is* the design, and the full name lives in the tooltip.
 */

/**
 * Every ISO 3166-1 alpha-2 code, sorted.
 *
 * The full set rather than a curated shortlist. A picker that offers thirty
 * countries tells everybody else that the game was not built with them in mind,
 * which is a large thing to say in order to save one kilobyte.
 */
export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const KNOWN = new Set<string>(COUNTRY_CODES);

/**
 * Read a country code off untrusted input.
 *
 * Uppercased first, so a `gb` from a hand-written request or an older client is
 * accepted rather than silently rejected — the code is the identity here, and
 * its case is a formatting detail. Anything not on the list becomes `undefined`
 * rather than being stored: an unrecognised code would render as two arbitrary
 * letters beside somebody's name and, worse, would partition the country index
 * into a country that does not exist.
 */
export function asCountry(value: unknown): CountryCode | undefined {
  if (typeof value !== 'string') return undefined;
  const code = value.trim().toUpperCase();
  return KNOWN.has(code) ? (code as CountryCode) : undefined;
}

/**
 * Resolved once and reused.
 *
 * Constructing an `Intl.DisplayNames` is not free, and a leaderboard asks for
 * one name per row on every render.
 */
let names: Intl.DisplayNames | undefined;
let tried = false;

function displayNames(): Intl.DisplayNames | undefined {
  if (!tried) {
    tried = true;
    try {
      // The reader's own locale, not the game's. A player in France gets
      // "Royaume-Uni" without this file knowing that word exists.
      names = new Intl.DisplayNames(undefined, { type: 'region' });
    } catch {
      // Every browser this game supports has it. The guard is for the ones it
      // does not know about yet, where a missing tooltip is a far better
      // outcome than a page that throws while rendering a leaderboard.
    }
  }
  return names;
}

/**
 * The full name for a code, for a tooltip.
 *
 * **Anything not on our list is answered with itself, without asking Intl.**
 * That guard is deliberate rather than defensive: `Intl.DisplayNames.of('ZZ')`
 * does not fail, it cheerfully returns "Unknown Region" — ZZ being a real CLDR
 * code meaning exactly that. So a legacy record with a junk code would have
 * produced a tooltip reading "Unknown Region" beside a chip reading "ZZ",
 * which is worse than useless: it looks like a country the game has heard of.
 *
 * Repeating the code is the honest degradation. The tooltip says what the chip
 * says, and nothing claims more than is known.
 */
export function countryName(code: string): string {
  const known = asCountry(code);
  if (!known) return code;

  try {
    return displayNames()?.of(known) ?? known;
  } catch {
    return known;
  }
}

/**
 * Every country, named and sorted for a picker.
 *
 * Sorted with `localeCompare` rather than by code, because a dropdown ordered
 * AD, AE, AF is ordered by a fact the reader cannot see. Computed on demand and
 * cached — the picker is opened rarely and this is 250 string comparisons.
 */
let listed: Array<{ code: CountryCode; name: string }> | undefined;

export function countryOptions(): Array<{ code: CountryCode; name: string }> {
  listed ??= COUNTRY_CODES
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return listed;
}
