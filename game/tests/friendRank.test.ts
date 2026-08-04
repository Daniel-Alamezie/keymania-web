import { describe, expect, it } from 'vitest';
import {
  contenders, friendStanding, rankFriends, type Board, type Contender,
} from '../friendRank';
import type { Friend } from '@/models/friends';

/**
 * Ranking among friends.
 *
 * The arithmetic is trivial and is not what these are for. Every case here is
 * one of the ways a small pool breaks a sort that works fine on a big one: an
 * empty list, a pool of one, everybody tied, and — the one that actually bit
 * the first draft — a friend whose figure is zero because they have never
 * played, which is not the same as a friend who played and scored nothing.
 */

const c = (over: Partial<Contender> = {}): Contender => ({
  handle: 'someone', displayName: 'Someone', ...over,
});

const BOARDS: Board[] = ['standings', 'speed', 'streak', 'weekly'];

/** The same contender expressed for whichever board is under test. */
const on = (board: Board, value: number, over: Partial<Contender> = {}): Contender => ({
  ...c(over),
  ...(board === 'standings' ? { rating: value } : {}),
  ...(board === 'speed' ? { bestWpm: value } : {}),
  ...(board === 'streak' ? { bestStreak: value } : {}),
  ...(board === 'weekly' ? { weekly: { words: 10, wpm: 80, score: value } } : {}),
});

describe('rankFriends', () => {
  describe.each(BOARDS)('on the %s board', (board) => {
    it('orders best first and numbers from one', () => {
      const placed = rankFriends([
        on(board, 300, { handle: 'c', displayName: 'Cass' }),
        on(board, 900, { handle: 'a', displayName: 'Ana' }),
        on(board, 600, { handle: 'b', displayName: 'Bo' }),
      ], board);

      expect(placed.map((p) => [p.handle, p.position])).toEqual([
        ['a', 1], ['b', 2], ['c', 3],
      ]);
    });

    it('gives tied contenders the same place and skips the next', () => {
      const placed = rankFriends([
        on(board, 900, { handle: 'a' }),
        on(board, 600, { handle: 'b' }),
        on(board, 600, { handle: 'c' }),
        on(board, 100, { handle: 'd' }),
      ], board);

      // Two share second, so the next is fourth. Not third.
      expect(placed.map((p) => p.position)).toEqual([1, 2, 2, 4]);
    });

    it('leaves somebody who has never played unranked rather than last', () => {
      /**
       * The case the first draft got wrong. All four figures default to 0 on a
       * record that has never earned one, so a `!== undefined` check ranks a
       * player who has never survived a word as though they had run and scored
       * nothing — a phantom last place handed to whoever was newest.
       */
      const placed = rankFriends([
        on(board, 900, { handle: 'a' }),
        on(board, 0, { handle: 'zero' }),
        c({ handle: 'absent', displayName: 'Absent' }),
      ], board);

      expect(placed.find((p) => p.handle === 'a')?.position).toBe(1);
      expect(placed.find((p) => p.handle === 'zero')?.position).toBeUndefined();
      expect(placed.find((p) => p.handle === 'absent')?.position).toBeUndefined();
    });

    it('keeps the unranked in the list, after everyone with a score', () => {
      // They are still your friends. Dropping them turns "the friends board"
      // into "the friends who have played this board", with nothing saying so.
      const placed = rankFriends([
        c({ handle: 'absent', displayName: 'Absent' }),
        on(board, 900, { handle: 'a' }),
      ], board);

      expect(placed).toHaveLength(2);
      expect(placed.at(-1)?.handle).toBe('absent');
    });
  });

  it('ranks each board on its own figure, not on rating for all four', () => {
    /**
     * The mistake that would make three of the four boards identical, and it
     * would look right on the standings board where it was tested.
     */
    const pool = [
      c({ handle: 'slow-but-rated', rating: 2000, bestWpm: 40, bestStreak: 5 }),
      c({ handle: 'fast-but-new', rating: 100, bestWpm: 150, bestStreak: 90 }),
    ];

    expect(rankFriends(pool, 'standings')[0].handle).toBe('slow-but-rated');
    expect(rankFriends(pool, 'speed')[0].handle).toBe('fast-but-new');
    expect(rankFriends(pool, 'streak')[0].handle).toBe('fast-but-new');
  });

  it('orders the weekly board on the server score, not on words', () => {
    /**
     * Two players on the same word count are separated by who got there sooner,
     * and that tiebreak is already folded into `score` by the API. Ranking on
     * `words` would tie them and pick arbitrarily.
     */
    const placed = rankFriends([
      c({ handle: 'slower', weekly: { words: 40, wpm: 70, score: 4_000_100 } }),
      c({ handle: 'sooner', weekly: { words: 40, wpm: 95, score: 4_000_900 } }),
    ], 'weekly');

    expect(placed.map((p) => p.handle)).toEqual(['sooner', 'slower']);
  });

  it('does not reshuffle the unranked tail between refreshes', () => {
    // The endpoint's order is not stable. Sorting the tail by nothing means the
    // bottom of the board rearranges itself every time the panel polls.
    const pool = [
      c({ handle: 'c', displayName: 'Cass' }),
      c({ handle: 'a', displayName: 'Ana' }),
      c({ handle: 'b', displayName: 'Bo' }),
    ];
    const first = rankFriends(pool, 'standings').map((p) => p.handle);
    const again = rankFriends([...pool].reverse(), 'standings').map((p) => p.handle);

    expect(first).toEqual(again);
    expect(first).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty pool', () => {
    expect(rankFriends([], 'standings')).toEqual([]);
  });

  it('handles a pool of one', () => {
    expect(rankFriends([on('standings', 900)], 'standings')[0].position).toBe(1);
  });

  it('does not mutate the pool it is given', () => {
    const pool = [on('standings', 100, { handle: 'a' }), on('standings', 900, { handle: 'b' })];
    const before = pool.map((p) => p.handle);

    rankFriends(pool, 'standings');

    expect(pool.map((p) => p.handle)).toEqual(before);
  });
});

describe('friendStanding', () => {
  it('finds you in the pool', () => {
    const standing = friendStanding([
      on('standings', 900, { handle: 'a' }),
      on('standings', 600, { handle: 'me', you: true }),
      on('standings', 300, { handle: 'b' }),
    ], 'standings');

    expect(standing).toEqual({ position: 2, of: 3 });
  });

  it('counts only contenders who are actually on the board', () => {
    /**
     * "#2 of 12" when ten of the twelve have never played implies you beat
     * people who were never in the running. The total has to be what the
     * position is out of.
     */
    const standing = friendStanding([
      on('standings', 900, { handle: 'a' }),
      on('standings', 600, { handle: 'me', you: true }),
      c({ handle: 'never-played-1', displayName: 'One' }),
      c({ handle: 'never-played-2', displayName: 'Two' }),
    ], 'standings');

    expect(standing).toEqual({ position: 2, of: 2 });
  });

  it('says nothing when you are not in the pool', () => {
    // Signed out, or a profile still loading. The board is fine; it just
    // cannot say where you are on it.
    expect(friendStanding([on('standings', 900, { handle: 'a' })], 'standings')).toBeUndefined();
  });

  it('says nothing when you are unranked, rather than putting you last', () => {
    const standing = friendStanding([
      on('standings', 900, { handle: 'a' }),
      c({ handle: 'me', displayName: 'Me', you: true }),
    ], 'standings');

    expect(standing).toBeUndefined();
  });

  it('makes you first when you have no friends on the board yet', () => {
    expect(friendStanding([on('standings', 900, { handle: 'me', you: true })], 'standings'))
      .toEqual({ position: 1, of: 1 });
  });
});

describe('contenders', () => {
  const friend = (over: Partial<Friend> = {}): Friend => ({
    handle: 'pal', displayName: 'Pal', state: 'accepted', since: 1, ...over,
  } as Friend);

  it('marks exactly one contender as you', () => {
    const pool = contenders([friend({ handle: 'a' }), friend({ handle: 'b' })], {
      handle: 'me', displayName: 'Me', rating: 800,
    });

    expect(pool.filter((p) => p.you)).toHaveLength(1);
    expect(pool.find((p) => p.you)?.handle).toBe('me');
  });

  it('includes you, so nobody below you is off by one', () => {
    /**
     * Forgetting the viewer produces a board that looks entirely normal and is
     * wrong by exactly one place for every friend beneath them — the kind of
     * bug that gets reported as "the ranking seems off" and never reproduced.
     */
    const pool = contenders([friend({ handle: 'a', rating: 900 })], {
      handle: 'me', displayName: 'Me', rating: 950,
    });

    expect(rankFriends(pool, 'standings').map((p) => p.handle)).toEqual(['me', 'a']);
  });

  it('carries every board figure across from a friend row', () => {
    // A field dropped here is a board that silently ranks nobody.
    const pool = contenders([friend({
      handle: 'a', rating: 900, bestWpm: 120, bestStreak: 40,
      weekly: { words: 30, wpm: 90, score: 4_000_000 },
    })], null);

    expect(pool[0]).toMatchObject({
      rating: 900, bestWpm: 120, bestStreak: 40,
      weekly: { words: 30, wpm: 90, score: 4_000_000 },
    });
  });

  it('carries what a friend is wearing', () => {
    /**
     * This one shipped broken, and it is worth saying why it got through: the
     * row component reads `cosmetics` or renders nothing, so dropping the field
     * threw no error and logged no warning — it produced a friends board on
     * which nobody wore anything, which looks like a board of players who have
     * not earned badges yet.
     *
     * A figure going missing is loud; an ornament going missing is silent, and
     * silent is the kind that reaches production.
     */
    const worn = { badge: 'animated/founder.png', badgeLabel: 'Founder', badgeNumber: 200 };
    const pool = contenders([friend({ handle: 'a', cosmetics: worn })], null);

    expect(pool[0].cosmetics).toEqual(worn);
  });

  it('survives the rank, so a badge is not lost between sorting and rendering', () => {
    // `contenders` carrying it is only half the path — `rankFriends` rebuilds
    // every object it returns, and a spread that missed this would undo it.
    const worn = { badge: 'animated/crown.png', badgeLabel: 'Champion' };
    const placed = rankFriends(
      contenders([friend({ handle: 'a', rating: 900, cosmetics: worn })], null),
      'standings',
    );

    expect(placed[0].cosmetics).toEqual(worn);
  });

  it('keeps a badge on somebody who is unranked', () => {
    // The unranked tail is rebuilt down a different branch, which is exactly
    // the sort of split where one path keeps a field and the other drops it.
    const worn = { badge: 'animated/first-blood.png' };
    const placed = rankFriends(
      contenders([friend({ handle: 'new', cosmetics: worn })], null),
      'standings',
    );

    expect(placed[0].position).toBeUndefined();
    expect(placed[0].cosmetics).toEqual(worn);
  });

  it('works signed out', () => {
    const pool = contenders([friend()], null);
    expect(pool).toHaveLength(1);
    expect(pool.some((p) => p.you)).toBe(false);
  });
});
