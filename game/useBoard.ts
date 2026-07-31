'use client';

// The store owns the state, so nothing here needs local React state.
import { useEffect, useSyncExternalStore } from 'react';
import {
  BOARDS, PANEL_LIMIT, type BoardEntry, type BoardKind, type LeaderboardResponse,
} from '@/models/leaderboard';

export type BoardStatus = 'loading' | 'ready' | 'unavailable';

/* -------------------------------------------------------------------------
 * The store.
 *
 * Module-level, not component state, and that is the whole change. The cache
 * used to live inside this hook, which meant it lived and died with whichever
 * component was holding it — and `LeaderboardPanel` is rendered by `Game`, which
 * swaps the menu out entirely for a duel or a run. Every trip into a game and
 * back was therefore a fresh mount, an empty cache, and the board fetched again
 * from nothing with a "Loading…" line where the rows had been.
 *
 * Toggling tabs had the same problem in miniature until the per-board cache was
 * added; this is that fix finished, because a cache that only survives while
 * nobody navigates is not really a cache.
 *
 * Same arrangement `serverProfile` arrived at for the account record, for the
 * same reasons, and deliberately spelled the same way — a second store shaped
 * differently would be a second set of caching bugs to find.
 * ---------------------------------------------------------------------- */

/**
 * How long a fetched board is served without re-checking.
 *
 * Shorter than the profile's window, because this is everybody's data rather
 * than one account's: it moves whenever anyone anywhere finishes a game, and
 * nothing that happens in this browser can know about it. Long enough that
 * flicking between the three tabs, or stepping into the menu and out again,
 * costs nothing.
 *
 * The case this window is not responsible for is the player's own result, which
 * is what `invalidateBoards` is for — waiting up to half a minute to see a run
 * you just finished appear would read as the board being broken.
 */
const STALE_AFTER_MS = 30_000;

interface Cached {
  entries: BoardEntry[];
  at: number;
  /**
   * How many rows were asked for when this was fetched.
   *
   * Kept because a cache that only remembers the rows forgets the question. The
   * menu wants five and the full board wants fifty, and without this the page
   * would be served the panel's ten and conclude that was the whole board —
   * which is the bug that has just been fixed on the server, reintroduced one
   * layer up.
   */
  limit: number;
}

/**
 * Not persisted to localStorage, unlike the account record.
 *
 * That one is about you and is nearly always still true when you come back. This
 * is a live ranking of other people, and showing yesterday's on first paint
 * would be presenting stale numbers as current — a slightly slower first load is
 * the better trade. Within a session it is cached hard.
 */
const cache = new Map<BoardKind, Cached>();
const failed = new Set<BoardKind>();
const inflight = new Map<BoardKind, Promise<void>>();
const listeners = new Set<() => void>();

/**
 * Bumped on every change, so subscribers can tell one apart from the next.
 *
 * `useSyncExternalStore` compares snapshots by identity, and the snapshot here
 * is an array that lives in a Map. Returning it directly is correct and returning
 * a fresh derived object is an infinite render, so the version is what the hook
 * watches and the entries are read separately.
 */
let version = 0;

function changed() {
  version += 1;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

/**
 * Fetch a board unless a fresh copy is already in hand.
 *
 * Concurrent callers share one request: the menu panel and the full board can
 * both be asking for the same thing, and two components wanting the same rows is
 * not a reason to ask twice.
 */
export function ensureBoard(board: BoardKind, limit = PANEL_LIMIT): Promise<void> {
  const held = cache.get(board);
  /**
   * Held only if it is both recent enough and long enough.
   *
   * Asking for more rows than are cached is a different question, so a short
   * answer does not settle it however fresh that answer is.
   */
  const fresh = held && Date.now() - held.at < STALE_AFTER_MS && held.limit >= limit;
  /**
   * A board known to be unreachable is not retried, whatever is asked of it.
   *
   * The first attempt at this excused a bigger ask, on the reasoning that
   * wanting more rows is a different question. It is not a reachable one: a
   * failed fetch caches nothing, so "bigger than what is held" was always true
   * and a dead board was hammered on every render. The test caught it.
   *
   * Nothing is lost by the simpler rule. `hasMore` needs cached rows to be true,
   * so the control that asks for more never appears on a board that failed.
   */
  if (fresh || failed.has(board)) return Promise.resolve();

  const already = inflight.get(board);
  if (already) return already;

  const request = (async () => {
    try {
      const response = await fetch(
        `/api/board?board=${board}&limit=${limit}`,
        { cache: 'no-store' },
      );
      if (!response.ok) {
        // Only a failure worth showing if there is nothing already on screen.
        // Replacing a readable board with an error helps nobody.
        if (!cache.has(board)) failed.add(board);
        return;
      }

      const body = (await response.json()) as LeaderboardResponse;

      /**
       * The answer is filed under the board that answered, not the one asked
       * for.
       *
       * The API echoes `board` precisely so a fallback is visible, and nothing
       * on this side was reading it. When the deployed API did not yet know
       * about `streak` it fell back to the speed board and answered with those
       * rows, which were then rendered under the Survival tab with every streak
       * reading zero — a frontend that looked broken because it believed a
       * reply to a different question.
       *
       * Filing it correctly means the tab shows its empty message, which is the
       * truth, and the caller is not left inventing an explanation.
       */
      const answered = BOARDS.includes(body.board) ? body.board : board;
      cache.set(answered, { entries: body.entries ?? [], at: Date.now(), limit });
      failed.delete(answered);
      changed();
    } catch {
      // Offline. Keep whatever is cached rather than replacing something useful
      // with an error nobody can act on.
      if (!cache.has(board)) {
        failed.add(board);
        changed();
      }
    } finally {
      inflight.delete(board);
    }
  })();

  inflight.set(board, request);
  return request;
}

/**
 * Drop every board, because something this player did could have moved one.
 *
 * Finishing a run or a rated duel changes a board they are plausibly on, and the
 * staleness window cannot know that: it exists for other people's results, which
 * nothing here can hear about. Without this a player would come back from the
 * best run of their life to a board that had not noticed.
 *
 * All three rather than the one guessed at. A rated duel moves the standings and
 * possibly the speed board; a run moves the streak board; and the cost of being
 * wrong is a stale board, while the cost of dropping all three is one request
 * per board actually looked at.
 */
export function invalidateBoards(): void {
  cache.clear();
  failed.clear();
  changed();
}

/**
 * A board, fetched once and then kept.
 *
 * Returns whatever is cached immediately and revalidates behind it, so a board
 * already seen never goes back to a spinner. The status is derived rather than
 * stored — it is a pure function of what has been fetched, so making it one
 * removes both an extra render and any chance of it disagreeing with the cache.
 */
export function useBoard(board: BoardKind, limit = PANEL_LIMIT): {
  entries: BoardEntry[] | undefined;
  status: BoardStatus;
  /** Whether asking for more would plausibly return any, so a control can hide. */
  hasMore: boolean;
} {
  useSyncExternalStore(subscribe, () => version, () => 0);

  /**
   * Asked for from an effect, not during render.
   *
   * `ensureBoard` reads the clock to judge staleness and may start a fetch, so
   * calling it while rendering would be an impure render — the rule this
   * codebase has now tripped over three times. It costs nothing here: a board
   * already cached is returned below on the first render whatever the effect
   * does, and a board that is not cached has nothing to show until the request
   * lands anyway.
   */
  useEffect(() => { void ensureBoard(board, limit); }, [board, limit]);

  const held = cache.get(board);
  const entries = held?.entries;
  return {
    entries,
    status: entries ? 'ready' : failed.has(board) ? 'unavailable' : 'loading',
    /**
     * A full page is the only evidence there might be another.
     *
     * The route does not say how many players exist and should not have to
     * count them: that is a scan of the whole table to render a button. A page
     * that came back exactly as long as it was allowed is the usual signal, and
     * its one failure is offering "more" on a board whose size lands exactly on
     * the boundary — which costs a click and one empty answer.
     */
    hasMore: Boolean(held && held.entries.length >= held.limit),
  };
}
