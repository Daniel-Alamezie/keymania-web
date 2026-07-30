'use client';

import { useEffect, useState } from 'react';
import type { BoardEntry, BoardKind, LeaderboardResponse } from '@/models/leaderboard';

export type BoardStatus = 'loading' | 'ready' | 'unavailable';

/**
 * Fetching a board, once per board.
 *
 * Lifted out of LeaderboardPanel so the full-board page can use the same one.
 * Two copies of this would have been two chances to disagree about what an empty
 * board means, and the panel's version had already earned a couple of fixes that
 * a fresh copy would have had to earn again.
 */
export function useBoard(board: BoardKind): {
  entries: BoardEntry[] | undefined;
  status: BoardStatus;
} {
  /**
   * Every board kept once fetched, keyed by which one it is.
   *
   * Toggling is a view change, not new information, so it should not cost a
   * spinner the second time. A single `entries` array blanked the list on every
   * press instead, which is the same needless-refetch flicker already fixed on
   * the profile.
   */
  const [cache, setCache] = useState<Partial<Record<BoardKind, BoardEntry[]>>>({});
  /** Boards whose fetch failed, so a dead one is not retried on every render. */
  const [failed, setFailed] = useState<Partial<Record<BoardKind, true>>>({});

  const entries = cache[board];

  /**
   * Derived, not stored.
   *
   * A `status` state variable had to be set from inside the effect on the
   * cache-hit path, which is a synchronous setState in an effect body: a
   * cascading render, and one the lint rule rejects outright. Status is a pure
   * function of what has been fetched, so making it one removes both the extra
   * render and any chance of it disagreeing with the cache.
   */
  const status: BoardStatus = entries ? 'ready' : failed[board] ? 'unavailable' : 'loading';

  useEffect(() => {
    // Already held, or already known to be unreachable. An empty array counts as
    // held, so a genuinely empty board is not re-fetched on every look.
    if (entries || failed[board]) return;

    // Guards a late response from landing after unmount, or after the reader has
    // already switched to the other board.
    let live = true;

    (async () => {
      try {
        const response = await fetch(`/api/board?board=${board}`, { cache: 'no-store' });
        if (!live) return;

        if (!response.ok) {
          setFailed((prev) => ({ ...prev, [board]: true }));
          return;
        }
        const { entries: rows } = (await response.json()) as LeaderboardResponse;
        if (!live) return;

        setCache((prev) => ({ ...prev, [board]: rows }));
      } catch {
        if (live) setFailed((prev) => ({ ...prev, [board]: true }));
      }
    })();

    return () => { live = false; };
  }, [board, entries, failed]);

  return { entries, status };
}
