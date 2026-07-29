'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDisplayName, useHandle } from '@/game/serverProfile';
import {
  BOARDS, BOARD_META, DEFAULT_BOARD,
  type BoardEntry, type BoardKind, type LeaderboardResponse,
} from '@/models/leaderboard';
import { START_RATING } from '@/models/rating';
import RankFlame, { type Podium } from './RankFlame';
import BoardGuide from './BoardGuide';
import styles from './SidePanel.module.css';

/**
 * The global standings.
 *
 * Two boards, and **standings leads**. It used to open on fastest-duel, which
 * turned out to be an incentive pointing the wrong way: a speed board is a
 * `max()`, so the correct play on reaching first place is to never duel again
 * in case you can't repeat it. Rating only moves by playing, so that is the
 * number a new arrival sees first.
 *
 * Every figure is computed by the server from a duel it refereed. Bot practice
 * is kept against a player's own record but never reaches either board, because
 * a result the browser reported about itself cannot be ranked.
 *
 * Deliberately global-only: it used to fall back to this browser's own runs,
 * which made a private list look like a public one. An empty board that says so
 * is more honest than a full board that means nothing.
 */

export default function LeaderboardPanel() {
  const [board, setBoard] = useState<BoardKind>(DEFAULT_BOARD);
  /**
   * Both boards kept once fetched, keyed by which one they are.
   *
   * Toggling is a view change, not new information, so it should not cost a
   * spinner the second time. Storing one `entries` array instead meant flicking
   * between tabs blanked the panel on every press — the same needless-refetch
   * flicker already fixed on the profile.
   */
  const [cache, setCache] = useState<Partial<Record<BoardKind, BoardEntry[]>>>({});
  /** Boards whose fetch failed, so a dead one is not retried on every render. */
  const [failed, setFailed] = useState<Partial<Record<BoardKind, true>>>({});
  const [showGuide, setShowGuide] = useState(false);
  const myName = useDisplayName();
  const myHandle = useHandle();

  const entries = cache[board];
  const meta = BOARD_META[board];

  /**
   * Derived, not stored.
   *
   * A `status` state variable had to be set from inside the effect on the
   * cache-hit path, which is a synchronous setState in an effect body — a
   * cascading render, and one the lint rule rejects outright. Status is a pure
   * function of what has been fetched, so making it one removes both the extra
   * render and the chance of it disagreeing with the cache.
   */
  const status = entries ? 'ready' : failed[board] ? 'unavailable' : 'loading';

  useEffect(() => {
    // Already held, or already known to be unreachable. An empty array counts
    // as held, so a genuinely empty board is not re-fetched on every look.
    if (entries || failed[board]) return;

    // Guards a late response from landing after unmount, or after the player
    // has already switched to the other board.
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

  return (
    <aside className={`panel ${styles.side}`}>
      {/* The heading is the tab strip, so the panel keeps its place on the
          arena screen rather than growing a second box above itself. Same
          pattern as the record panel opposite. */}
      <div className={styles.tabs} role="tablist" aria-label="Leaderboard">
        {BOARDS.map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={kind === board}
            className={`${styles.tab} pixel-font`}
            data-active={kind === board || undefined}
            onClick={() => setBoard(kind)}
          >
            {BOARD_META[kind].tab}
          </button>
        ))}
      </div>

      {status === 'loading' && <p className={styles.empty}>Loading the {meta.heading.toLowerCase()}…</p>}

      {status === 'unavailable' && (
        <p className={styles.empty}>The standings are unreachable right now.</p>
      )}

      {status === 'ready' && entries?.length === 0 && (
        <p className={styles.empty}>
          Nobody has been ranked yet. Beat another player and the board is yours.
        </p>
      )}

      {status === 'ready' && entries && entries.length > 0 && (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const podium = entry.position <= 3 ? (entry.position as Podium) : null;
            /**
             * The big number is whichever board you are on, and the small one
             * is the other figure — so a row still tells you both things and
             * the ordering is never ambiguous about which it followed.
             */
            const score = board === 'standings' ? entry.rating ?? START_RATING : entry.wpm;
            const sub = board === 'standings' ? `${entry.wpm} wpm` : `${entry.accuracy}%`;

            return (
              <li
                // Keyed on the handle where there is one: display names are not
                // unique, so two players called the same thing shared a key and
                // React had no way to tell their rows apart.
                key={entry.handle ?? `${entry.position}-${entry.name}`}
                className={styles.rank}
                /**
                 * Matched on handle where both sides have one, and only on
                 * name as a fallback.
                 *
                 * Names are not unique, so the old comparison highlighted
                 * every player who happened to share yours as though they
                 * were you. The fallback is kept for accounts that predate
                 * handles, where a name is the only thing to go on and being
                 * occasionally wrong beats never highlighting anybody.
                 */
                data-me={(myHandle && entry.handle
                  ? entry.handle === myHandle
                  : Boolean(myName) && entry.name === myName) || undefined}
                data-top={entry.position === 1 || undefined}
              >
                <span className={`${styles.rankPos} pixel-font`}>{entry.position}</span>
                {/* The slot is always rendered, empty below third, so names
                    stay in one column down the whole board. */}
                <span className={styles.rankFlame}>
                  {/* 17px is the sprite's own height — see RankFlame on why not 19. */}
                  {podium && <RankFlame rank={podium} height={17} />}
                </span>
                {/* Only a link once a player has a handle. Accounts that
                    reached the board before handles existed have nothing to
                    link to, and are rendered as plain text rather than as a
                    control that goes nowhere. */}
                {/* Your own row points straight at the dashboard. Sending it
                    to /u/ instead would render the public card and then bounce,
                    and the flash of somebody else's view of you is exactly what
                    the redirect is there to avoid. */}
                {entry.handle ? (
                  <Link
                    href={entry.handle === myHandle ? '/profile' : `/u/${entry.handle}`}
                    className={styles.rankName}
                    data-link
                  >
                    {entry.name}
                  </Link>
                ) : (
                  <span className={styles.rankName}>{entry.name}</span>
                )}
                <span className={styles.rankSub}>{sub}</span>
                <span className={`${styles.rankScore} pixel-font`} aria-label={meta.scoreLabel}>
                  {score}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.footnote}>
        {meta.footnote}{' '}
        {/* A link rather than a paragraph of rules in the panel. Somebody who
            already understands the board should not have to scroll past an
            explanation of it every time they check their position. */}
        <button type="button" className={styles.footLink} onClick={() => setShowGuide(true)}>
          How the boards work
        </button>
      </p>

      {showGuide && <BoardGuide onClose={() => setShowGuide(false)} />}
    </aside>
  );
}
