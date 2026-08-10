'use client';

import { useMemo } from 'react';
import { useFriends } from './friends';
import { useServerProfile } from './serverProfile';
import { contenders, rankFriends, type Board } from './friendRank';
import type { BoardEntry, BoardKind } from '@/models/leaderboard';
import { resolveWorn } from '@/models/cosmetics';

/**
 * The same four boards, narrowed to people you actually know.
 *
 * **There is no request behind this.** A friends board has no global existence
 * to be fetched — "my friends" is a different set for every viewer, so the
 * server would be building one per caller out of data the caller already holds.
 * GET /friends already returns each friend's rating, best speed and furthest
 * streak, so this is a sort of an array in memory: switching the toggle costs a
 * render and nothing else, which is why it feels instant rather than like
 * loading a second board.
 *
 * The weekly board is the one exception, and it pays for itself: weekly results
 * live in their own rows upstream, so that board asks for `include=weekly` and
 * costs one extra read per friend. Only while it is the board on screen.
 *
 * Returns the same shape as `useBoard`, so the two are interchangeable at the
 * call site and neither the panel nor the full-board page needs to know which
 * one it is rendering.
 */

export type FriendBoardStatus = 'loading' | 'ready' | 'anonymous' | 'noFriends';

/**
 * The board names the friends view can order on.
 *
 * Identical to the four the API serves, but stated as its own mapping rather
 * than assumed: `BoardKind` is what a URL and a tab strip speak, and `Board` is
 * what the ranking speaks. They agree today, and a rename on either side that
 * silently changed which figure a board sorted by would be a very quiet bug.
 */
const AS_METRIC: Record<BoardKind, Board> = {
  standings: 'standings',
  speed: 'speed',
  streak: 'streak',
  weekly: 'weekly',
};

/** What each board puts in the row's headline figure. */
function figures(board: BoardKind, c: {
  rating?: number; bestWpm?: number; bestStreak?: number;
  weekly?: { words: number; wpm: number };
}) {
  return {
    // Every row carries all four, exactly as the global board's rows do, because
    // BoardRows decides per board which to show and a missing one renders as a
    // gap rather than as an error.
    rating: c.rating,
    wpm: board === 'weekly' ? (c.weekly?.wpm ?? 0) : (c.bestWpm ?? 0),
    streak: c.bestStreak,
    words: c.weekly?.words,
  };
}

export function useFriendBoard(
  board: BoardKind,
  /**
   * Whether the Friends view is actually on screen.
   *
   * The fetch is gated on it rather than run always. `useFriends` is per-caller
   * state with its own thirty-second poll — there is no shared cache — so an
   * always-on hook here would add a second poller beside the friends panel and
   * fan out one read per friend twice as often, to fill a board nobody switched
   * to.
   */
  active: boolean,
): {
  entries: BoardEntry[] | undefined;
  status: FriendBoardStatus;
} {
  /**
   * The weekly flag rides the board name: only that board needs each friend's
   * sprint, and asking for it on the other three would charge every viewer one
   * extra upstream read per friend for a column nothing renders.
   */
  const friends = useFriends(active, board === 'weekly');
  const { profile, anonymous } = useServerProfile();

  const entries = useMemo<BoardEntry[] | undefined>(() => {
    if (!profile) return undefined;

    const pool = contenders(friends.data.friends, {
      handle: profile.handle ?? '',
      displayName: profile.displayName,
      rating: profile.rating,
      bestWpm: profile.bestRankedWpm,
      bestStreak: profile.bestStreak,
      weekly: profile.weekly,
      /**
       * Your own row wears what you are wearing.
       *
       * Resolved here rather than taken as-is: your own profile holds catalogue
       * *ids* — the picker needs them to know what is selected — while every
       * board row wants the filename and colour those ids stand for. Friends
       * arrive already resolved by the server; you are the one row that does
       * not, and skipping this is how your row ends up the only bare one on a
       * board full of badges.
       */
      cosmetics: profile.cosmetics
        ? resolveWorn(
          profile.cosmetics.catalogue,
          profile.cosmetics,
          profile.cosmetics.founderNumber,
          profile.cosmetics.crownWeeks,
        )
        : undefined,
      you: true,
    });

    return rankFriends(pool, AS_METRIC[board]).map((c, index) => ({
      /**
       * Ranked contenders carry their competition position, ties and all.
       * Everybody else is numbered by where they fall in the list, so the
       * column is never blank — but they sort below anyone with a score, so
       * those numbers read as "the rest" rather than as places earned.
       */
      position: c.position ?? index + 1,
      name: c.displayName,
      handle: c.handle || undefined,
      /**
       * The field that was missing, and it failed silently.
       *
       * BoardRows is shared with the global board and reads `entry.cosmetics`
       * or draws nothing at all — so omitting it here did not error, did not
       * warn, and simply produced a friends board where nobody wore anything.
       * The same class of fault the leaderboard route's own comment warns
       * about upstream: an allowlist that is built by hand stays silent about
       * what it left out.
       */
      cosmetics: c.cosmetics,
      accuracy: 0,
      ...figures(board, c),
    }));
  }, [friends.data.friends, profile, board]);

  if (!active) return { entries: undefined, status: 'loading' };
  if (anonymous) return { entries: undefined, status: 'anonymous' };
  if (friends.loading || !profile) return { entries: undefined, status: 'loading' };
  // One entry means the viewer alone: a board of yourself is not a comparison,
  // and saying so is more use than showing a leaderboard with one row on it.
  if (friends.data.friends.length === 0) return { entries: undefined, status: 'noFriends' };

  return { entries, status: 'ready' };
}
