'use client';

import Link from 'next/link';
import { useDisplayName, useHandle } from '@/game/serverProfile';
import { BOARD_META, type BoardEntry, type BoardKind } from '@/models/leaderboard';
import { ratingFlame, START_RATING } from '@/models/rating';
import RankFlame, { Flame, type Podium } from './RankFlame';
import { badgeSrc, badgeTooltip } from '@/models/cosmetics';
import styles from './SidePanel.module.css';

/**
 * The rows of a board.
 *
 * Shared by the menu panel and the full-board page, which is the whole reason it
 * exists as its own file: a second copy would have meant two places deciding
 * what a crown means and which row is yours, and the rules below were each
 * arrived at by getting them wrong first.
 */
export default function BoardRows({ entries, board, asStranger }: {
  entries: BoardEntry[];
  board: BoardKind;
  /**
   * Render every row as though it belonged to somebody else.
   *
   * For the appearance preview, which exists to answer "what do other people
   * see". Left to itself this component would recognise the player's own name
   * and tint the row as theirs, and link it to their dashboard — both correct
   * on a real board and both wrong in a preview, where the tint is a thing no
   * stranger ever sees and the link goes somewhere the preview did not offer
   * to take anybody.
   *
   * A flag on the real renderer rather than a hand-built copy of a row. A copy
   * would look right on the day it was written and drift the first time a
   * badge moved or a column changed width, which is precisely the failure this
   * preview is meant to catch.
   */
  asStranger?: boolean;
}) {
  /**
   * An earned name colour, or nothing.
   *
   * Inline rather than a class, because the palette lives on the server and a
   * stylesheet cannot hold a colour it has not been told about. Returning
   * undefined rather than an empty object keeps the default styling entirely
   * untouched for the great majority of rows.
   */
  const colourOf = (entry: BoardEntry) =>
    (entry.cosmetics?.nameColour ? { color: entry.cosmetics.nameColour } : undefined);

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
        /**
         * A lookup rather than chained ternaries, which is what this was and
         * what stopped scaling at the third board: with two entries the reader
         * can hold both branches, with three the else-arm is doing double duty
         * and the pairing between a score and its sub-figure is implicit.
         *
         * Survival shows speed underneath rather than accuracy, and that is the
         * point of the row rather than a leftover: one wrong letter ends a run,
         * so every run on this board was perfect and an accuracy column would
         * read 100% all the way down. The speed is the figure that says how the
         * distance was earned.
         */
        const { score, sub } = ({
          standings: { score: rating, sub: `${entry.wpm} wpm` },
          speed: { score: entry.wpm, sub: `${entry.accuracy}%` },
          streak: { score: entry.streak ?? 0, sub: `${entry.wpm} wpm` },
        } satisfies Record<BoardKind, { score: number; sub: string }>)[board];

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
            data-me={(!asStranger && (myHandle && entry.handle
              ? entry.handle === myHandle
              : Boolean(myName) && entry.name === myName)) || undefined}
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
            {/*
              * A badge, where one is worn.
              *
              * Its own fixed slot rather than inline with the name, for the
              * same reason the podium flame has one: a row whose name starts
              * at a different x depending on what somebody earned is a column
              * that no longer scans. The slot collapses to nothing when empty,
              * so a board of players wearing nothing looks exactly as it did.
              *
              * Deliberately no title here. The row already carries a position,
              * a podium mark, a name, a figure and a score, and a title would
              * push the name into an ellipsis on a phone — so titles live on
              * the profile and the duel plate, where there is room to read one.
              */}
            {entry.cosmetics?.badge && (
              /* Hover says what the number means. The digits alone are two
                 quiet pixels of provenance; the words are for whoever cares
                 enough to ask. */
              <span className={styles.rankBadge} data-tip={badgeTooltip(entry.cosmetics)}>
                <img src={badgeSrc(entry.cosmetics.badge)} alt="" width={14} height={14} />
                {/* The founder's position, and only ever theirs. Tiny, because
                    it is provenance rather than a score — the column already
                    has a number that means something else entirely. */}
                {entry.cosmetics.badgeNumber !== undefined && (
                  <span className={styles.rankBadgeNo}>{entry.cosmetics.badgeNumber}</span>
                )}
              </span>
            )}

            {entry.handle && !asStranger ? (
              <Link
                href={entry.handle === myHandle ? '/profile' : `/u/${entry.handle}`}
                className={styles.rankName}
                style={colourOf(entry)}
                data-link
              >
                {entry.name}
              </Link>
            ) : (
              <span className={styles.rankName} style={colourOf(entry)}>{entry.name}</span>
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
