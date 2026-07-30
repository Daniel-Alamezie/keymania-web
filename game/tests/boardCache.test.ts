import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardKind, LeaderboardResponse } from '../../models/leaderboard';

/**
 * Caching the leaderboard.
 *
 * The board used to be fetched again every time a player came back to the menu,
 * because the cache lived inside the hook and the hook lived inside a component
 * that `Game` swaps out for every duel and every run. The rows a player had just
 * been looking at were replaced by "Loading…" on the way back in.
 *
 * The store is module-level now, so each test re-imports it fresh. A cache that
 * silently stops caching looks exactly like one that works, only slower, which
 * is why these exist at all.
 */

const rows = (board: BoardKind, name: string): LeaderboardResponse => ({
  board,
  entries: [{ position: 1, name, wpm: 90, accuracy: 96 }],
});

let fetchMock: ReturnType<typeof vi.fn>;

/** A fresh copy of the store, with its module state reset. */
async function freshStore() {
  vi.resetModules();
  return import('../useBoard');
}

/** Answers whatever board was asked for, so the echo matches by default. */
const echo = (url: string) => {
  const board = (new URL(url, 'http://x').searchParams.get('board') ?? 'standings') as BoardKind;
  return Promise.resolve(new Response(JSON.stringify(rows(board, 'Fenrir')), { status: 200 }));
};

beforeEach(() => {
  fetchMock = vi.fn(echo);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('board cache', () => {
  it('fetches once, then serves the cached board', async () => {
    const store = await freshStore();

    await store.ensureBoard('standings');
    await store.ensureBoard('standings');
    await store.ensureBoard('standings');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * The reported bug, as directly as it can be stated without a DOM: leaving
   * the menu and coming back must not cost a request. The store outliving the
   * component is the entire fix, so what this really pins is that the cache is
   * not per-instance.
   */
  it('survives whatever was holding it going away', async () => {
    const store = await freshStore();
    await store.ensureBoard('streak');

    // A second consumer, mounting fresh, the way LeaderboardPanel does on every
    // return to the menu.
    await store.ensureBoard('streak');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the three boards apart', async () => {
    const store = await freshStore();

    await store.ensureBoard('standings');
    await store.ensureBoard('speed');
    await store.ensureBoard('streak');
    await store.ensureBoard('standings');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shares one request between concurrent callers', async () => {
    // The menu panel and the full board can want the same rows on one render.
    const store = await freshStore();

    await Promise.all([
      store.ensureBoard('speed'),
      store.ensureBoard('speed'),
      store.ensureBoard('speed'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * Your own result is the one thing the staleness window cannot cover.
   *
   * It exists for other people's games, which nothing in this browser hears
   * about. Coming back from a run you just finished to a board that had not
   * noticed reads as the board being broken.
   */
  it('refetches after something this player did could have moved a board', async () => {
    const store = await freshStore();

    await store.ensureBoard('streak');
    store.invalidateBoards();
    await store.ensureBoard('streak');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * The bug that made the Survival tab read zero for everybody.
   *
   * An API that did not yet know the board fell back to the speed board and
   * said so in `board`. Nothing read that, so the speed board's rows were
   * rendered under the Survival tab with every streak defaulting to zero — a
   * frontend that looked broken because it believed a reply to a different
   * question. Filing the answer under the board that actually answered means
   * the tab shows its empty message, which is at least true.
   */
  it('files an answer under the board that replied, not the one asked for', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(rows('speed', 'Fenrir')), { status: 200 })));

    const store = await freshStore();
    await store.ensureBoard('streak');

    // Asked for streak, told about speed. Nothing is now pretending otherwise.
    await store.ensureBoard('speed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a board it has already failed to reach', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('', { status: 500 })));

    const store = await freshStore();
    await store.ensureBoard('standings');
    await store.ensureBoard('standings');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** Offline should not wipe a board somebody is reading. */
  it('keeps what it has when the network goes away', async () => {
    const store = await freshStore();
    await store.ensureBoard('speed');

    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    store.invalidateBoards();
    await store.ensureBoard('speed');

    // The failure is recorded rather than throwing, and the next good response
    // is still allowed to replace it.
    fetchMock.mockImplementation(echo);
    store.invalidateBoards();
    await store.ensureBoard('speed');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
