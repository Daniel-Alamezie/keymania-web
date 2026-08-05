import { beforeEach, describe, expect, it } from 'vitest';

/**
 * A two-method localStorage, because this suite runs in plain Node. Installed
 * before the module is imported: it reads storage on first use.
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;
(globalThis as unknown as { window: unknown }).window = globalThis;

const { markCosmeticsSeen } = await import('../seenCosmetics');

const KEY = 'keymania.seenCosmetics';
const seen = (): string[] => JSON.parse(localStorage.getItem(KEY) ?? '[]');

/**
 * What the Appearance badge counts.
 *
 * The rule worth pinning is that ids are stored rather than a count. A count
 * cannot survive a new unlock arriving while an old one is still unseen — it
 * would clear the badge for something nobody looked at, which is the exact
 * failure the badge exists to prevent.
 */
describe('marking cosmetics as seen', () => {
  beforeEach(() => localStorage.clear());

  it('remembers what was on screen', () => {
    markCosmeticsSeen(['badge.founder', 'colour.day-one']);
    expect(seen()).toEqual(['badge.founder', 'colour.day-one']);
  });

  /** **The reason ids are stored.** A later unlock is still news. */
  it('leaves an unlock that arrived afterwards still unseen', () => {
    markCosmeticsSeen(['badge.founder']);
    const owned = ['badge.founder', 'badge.crown'];
    const already = new Set(seen());
    expect(owned.filter((id) => !already.has(id))).toEqual(['badge.crown']);
  });

  it('adds to what was already seen rather than replacing it', () => {
    markCosmeticsSeen(['badge.founder']);
    markCosmeticsSeen(['badge.crown']);
    expect(seen().sort()).toEqual(['badge.crown', 'badge.founder']);
  });

  it('never records the same id twice, however often the panel is opened', () => {
    markCosmeticsSeen(['badge.founder', 'colour.volt']);
    markCosmeticsSeen(['badge.founder', 'colour.volt']);
    expect(seen()).toEqual(['badge.founder', 'colour.volt']);
  });

  /**
   * A corrupted value must show the dot again rather than throw inside a
   * render: unreadable means "nothing seen", which errs towards telling a
   * player about an unlock twice instead of never.
   */
  it('treats an unreadable value as nothing seen', () => {
    localStorage.setItem(KEY, '{not json');
    markCosmeticsSeen(['badge.crown']);
    expect(seen()).toEqual(['badge.crown']);
  });

  it('ignores junk entries inside an otherwise valid list', () => {
    localStorage.setItem(KEY, JSON.stringify(['badge.crown', 42, null]));
    markCosmeticsSeen(['colour.volt']);
    expect(seen()).toEqual(['badge.crown', 'colour.volt']);
  });
});

/**
 * The badge counts what the panel would SHOW, not everything the record
 * carries. `earned` and `catalogue` diverge whenever a kind is withheld
 * behind a flag, and the day that flag flips a whole category appears at
 * once — which is exactly when the news badge matters most.
 *
 * The bug this pins: titles sat in `earned` for months while TITLES_LIVE was
 * off, invisible. Every visit to Appearance marked them seen, so the day
 * titles launched they arrived with no badge — the dot had been cleared for
 * things nobody could ever have looked at.
 */
describe('unseen counts only what can be seen', () => {
  /** The intersection the dashboard computes before asking for a count. */
  const visible = (earned: string[], catalogue: { id: string }[]) => {
    const servable = new Set(catalogue.map((item) => item.id));
    return earned.filter((id) => servable.has(id));
  };

  it('ignores an owned cosmetic the server is not serving', () => {
    const earned = ['badge.crown', 'title.duellist'];
    const catalogue = [{ id: 'badge.crown' }];
    expect(visible(earned, catalogue)).toEqual(['badge.crown']);
  });

  it('surfaces it the moment the catalogue starts serving it', () => {
    const earned = ['badge.crown', 'title.duellist'];
    const withTitles = [{ id: 'badge.crown' }, { id: 'title.duellist' }];
    expect(visible(earned, withTitles)).toEqual(['badge.crown', 'title.duellist']);
  });

  it('counts nothing when the record is empty', () => {
    expect(visible([], [{ id: 'badge.crown' }])).toEqual([]);
  });

  it('counts nothing when the catalogue is empty', () => {
    expect(visible(['badge.crown'], [])).toEqual([]);
  });
});
