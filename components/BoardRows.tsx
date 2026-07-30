'use client';

import Link from 'next/link';
import { useDisplayName, useHandle } from '@/game/serverProfile';
import { BOARD_META, type BoardEntry, type BoardKind } from '@/models/leaderboard';
import { ratingFlame, START_RATING } from '@/models/rating';
import RankFlame, { Flame, type Podium } from './RankFlame';
import styles from './SidePanel.module.css';

/**
 * The rows of a board.
 *
 * Shared by the menu panel and the full-board page, which is the whole reason it
 * exists as its own file: a second copy would have meant two places deciding
 * what a crown means and which row is yours, and the rules below were each
 * arrived at by getting them wrong first.
 */
export default function BoardRows({ entries, board }: {
  entries: BoardEntry[];
  board: BoardKind;
}) {
  const myName = useDisplayName();
  const myHandle = useHandle();
  const meta = BOARD_META[board];

  return (
    <ul className={styles.list}>
      {entries.map((entry) => {
        const podium = entry.position <= 3 ? (entry.position as Podium) : null;
        /**
         * The big number is whichever board you are on, and the small one is the
         * other figure, so a row still tells you both things and the ordering is
         * never ambiguous about which it followed.
         */
        const rating = entry.rating ?? START_RATING;
        const score = board === 'standings' ? rating : entry.wpm;
        const sub = board === 'standings' ? `${entry.wpm} wpm` : `${entry.accuracy}%`;

        return (
          <li
            // Keyed on the handle where there is one: display names are not
            // unique, so two players called the same thing shared a key and
            // React had no way to tell their rows apart.
            key={entry.handle ?? `${entry.position}-${entry.name}`}
            className={styles.rank}
            /**
             * Matched on handle where both sides have one, and only on name as a
             * fallback.
             *
             * Names are not unique, so the old comparison highlighted every
             * player who happened to share yours as though they were you. The
             * fallback is kept for accounts that predate handles, where a name is
             * the only thing to go on and being occasionally wrong beats never
             * highlighting anybody.
             */
            data-me={(myHandle && entry.handle
              ? entry.handle === myHandle
              : Boolean(myName) && entry.name === myName) || undefined}
            data-top={entry.position === 1 || undefined}
          >
            <span className={`${styles.rankPos} pixel-font`}>{entry.position}</span>

            {/*
              * A crown for the podium, a band flame for everybody else.
              *
              * The slot used to be empty below third, which read as "you have
              * nothing" rather than "you are not top three", and left most of the
              * board looking unranked when every player on it has a rating and
              * therefore a band.
              *
              * Standings only. The flame means a rating band, and putting one on
              * a board that is not ordered by rating invites the reading that it
              * ranks something about speed.
              *
              * Both sizes are exact quarter-scale: the crown sprite is 68 tall
              * and the flame 76, so 17 and 19 land on whole source pixels. A
              * fraction between them maps some source rows to two screen pixels
              * and their neighbours to one, which at this size shows as a wobble.
              */}
            <span className={styles.rankFlame}>
              {podium
                ? <RankFlame rank={podium} height={17} />
                : board === 'standings' && <Flame kind={ratingFlame(rating)} height={19} />}
            </span>

            {/* Only a link once a player has a handle. Accounts that reached the
                board before handles existed have nothing to link to, and render
                as plain text rather than as a control that goes nowhere.

                Your own row points straight at the dashboard. Sending it to /u/
                instead would render the public card and then bounce, and the
                flash of somebody else's view of you is exactly what the redirect
                is there to avoid. */}
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
  );
}
