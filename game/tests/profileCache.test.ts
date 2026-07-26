import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerProfile } from '../serverProfile';

/**
 * Caching the account record.
 *
 * The dashboard used to refetch on every visit and block on a spinner while it
 * did, because the account chip and the dashboard each kept their own copy of
 * the same endpoint. These pin the behaviour that replaced it — a cache that
 * silently stops caching looks exactly like one that works, only slower.
 *
 * The store is module-level, so every test re-imports it fresh.
 */

const PROFILE: ServerProfile = {
  displayName: 'Fenrir',
  duels: 12, wins: 8,
  bestWpm: 91, bestAccuracy: 97, bestCombo: 14, bestRankedWpm: 88,
  history: [{ wpm: 88, accuracy: 97, won: true, at: 1000, ranked: true }],
};

/** Minimal in-memory Storage — the test runner has no DOM. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

let storage: Storage;
let fetchMock: ReturnType<typeof vi.fn>;

/** A fresh copy of the store, with its module state reset. */
async function freshStore() {
  vi.resetModules();
  return import('../serverProfile');
}

const ok = () => Promise.resolve(new Response(JSON.stringify(PROFILE), { status: 200 }));

beforeEach(() => {
  storage = memoryStorage();
  fetchMock = vi.fn(ok);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('profile cache', () => {
  it('fetches once, then serves the cached record', async () => {
    const store = await freshStore();

    await store.ensureProfile();
    await store.ensureProfile();
    await store.ensureProfile();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent callers', async () => {
    // The account chip and the leaderboard both ask on the same render.
    const store = await freshStore();

    await Promise.all([store.ensureProfile(), store.ensureProfile(), store.ensureProfile()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not hit the network at all when storage already holds a fresh record', async () => {
    // This is the reported bug: navigating back to the dashboard refetched a
    // record the app already had.
    storage.setItem('keymania.account.v1', JSON.stringify({ profile: PROFILE, at: Date.now() }));

    const store = await freshStore();
    await store.ensureProfile();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetches once the cached record is stale', async () => {
    // Two minutes old, against a one minute window.
    const at = Date.now() - 120_000;
    storage.setItem('keymania.account.v1', JSON.stringify({ profile: PROFILE, at }));

    const store = await freshStore();
    await store.ensureProfile();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches after a duel invalidates the record', async () => {
    const store = await freshStore();

    await store.ensureProfile();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    store.invalidateProfile();
    await store.ensureProfile();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('persists the record so it survives a reload', async () => {
    const store = await freshStore();
    await store.ensureProfile();

    const raw = storage.getItem('keymania.account.v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).profile).toMatchObject({ displayName: 'Fenrir' });
  });

  it('clears the cache on sign-out', async () => {
    const store = await freshStore();
    await store.ensureProfile();

    store.forgetProfile();

    expect(storage.getItem('keymania.account.v1')).toBeNull();
    await store.ensureProfile();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears a cached record when the session has expired', async () => {
    // A 401 must not leave the previous person's record on screen.
    storage.setItem('keymania.account.v1', JSON.stringify({ profile: PROFILE, at: 0 }));
    fetchMock.mockReturnValue(Promise.resolve(new Response('{}', { status: 401 })));

    const store = await freshStore();
    await store.ensureProfile();

    expect(storage.getItem('keymania.account.v1')).toBeNull();
  });

  it('drops the superseded standalone name cache', async () => {
    storage.setItem('keymania.displayName.v1', 'Fenrir');

    const store = await freshStore();
    await store.ensureProfile();

    expect(storage.getItem('keymania.displayName.v1')).toBeNull();
  });

  it('keeps a cached record on screen when the network is down', async () => {
    storage.setItem('keymania.account.v1', JSON.stringify({ profile: PROFILE, at: 0 }));
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')));

    const store = await freshStore();
    await store.ensureProfile();

    // Still cached, not blanked in favour of an error nobody can act on.
    expect(storage.getItem('keymania.account.v1')).not.toBeNull();
  });
});
