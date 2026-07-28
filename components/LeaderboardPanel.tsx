'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDisplayName, useHandle } from '@/game/serverProfile';
import type { BoardEntry, LeaderboardResponse } from '@/models/leaderboard';
import RankFlame, { type Podium } from './RankFlame';
import styles from './SidePanel.module.css';

/**
 * The global standings.
 *
 * Ranked on sustained speed rather than the fastest single word: one quick
 * short word is mostly luck, whereas speed held across a whole duel is skill.
 * Because a wrong key never advances the cursor, mistakes already cost time —
 * so this figure reflects accuracy without needing a separate penalty.
 *
 * Every figure is computed by the server from a duel it refereed. Bot practice
 * is kept against a player's own record but never reaches this board, because
 * a result the browser reported about itself cannot be ranked.
 *
 * Deliberately global-only: it used to fall back to this browser's own runs,
 * which made a private list look like a public one. An empty board that says so
 * is more honest than a full board that means nothing.
 */

type Status = 'loading' | 'ready' | 'unavailable';

export default function LeaderboardPanel() {
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const myName = useDisplayName();
  const myHandle = useHandle();

  useEffect(() => {
    // Guards a late response from overwriting state after unmount.
    let live = true;

    (async () => {
      try {
        const response = await fetch('/api/board', { cache: 'no-store' });
        if (!live) return;

        if (!response.ok) {
          setStatus('unavailable');
          return;
        }
        const { entries: board } = (await response.json()) as LeaderboardResponse;
        setEntries(board);
        setStatus('ready');
      } catch {
        if (live) setStatus('unavailable');
      }
    })();

    return () => { live = false; };
  }, []);

  return (
    <aside className={`panel ${styles.side}`}>
      <h2 className={`${styles.heading} pixel-font`}>Fastest duels</h2>

      {status === 'loading' && <p className={styles.empty}>Loading the standings…</p>}

      {status === 'unavailable' && (
        <p className={styles.empty}>The standings are unreachable right now.</p>
      )}

      {status === 'ready' && entries.length === 0 && (
        <p className={styles.empty}>
          Nobody has been ranked yet. Beat another player and the board is yours.
        </p>
      )}

      {status === 'ready' && entries.length > 0 && (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const podium = entry.position <= 3 ? (entry.position as Podium) : null;
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
                <span className={styles.rankSub}>{entry.accuracy}%</span>
                <span className={`${styles.rankScore} pixel-font`}>{entry.wpm}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.footnote}>
        Ranked on sustained speed across a whole duel, refereed by the server.
      </p>
    </aside>
  );
}
