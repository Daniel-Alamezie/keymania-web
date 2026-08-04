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
 * **`entry.country` arrives and is deliberately not drawn.** It was, briefly,
 * and the row could not afford it: the rail gives a name 115 pixels and the
 * chip took 20 of them back, so the longest names started truncating again on
 * the exact surface three separate fixes had just been made to protect.
 *
 * The width was the trigger; the reason it stays out is that everything else on
 * this row was *earned* — a position, a badge, a speed, a rating. Country is
 * the only element that is context rather than achievement, and on a board
 * whose whole job is ranking, it is the first thing that should go when the row
 * runs out of room. It lives on the profile card, where identity belongs and
 * where there is space to read it.
 *
 * The field is still sent. It costs nothing (the base row is already read for
 * the handle), it feeds the country board's own existence, and keeping it means
 * this is a rendering decision that can be revisited rather than a data one
 * that would need another deploy.
 *
 * Shared by the menu panel and the full-board page, which is the whole reason it
 * exists as its own file: a second copy would have meant two places deciding
 * what a crown means and which row is yours, and the rules below were each
 * arrived at by getting them wrong first.
 */
export default function BoardRows({ entries, board, asStranger, compact }: {
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
  /**
   * The narrow rail beside the menu, rather than the full-board page.
   *
   * The same row in 250px and in 640px cannot carry the same things. Measured
   * in the rail: the fixed furniture and the two figures took 211 of 250
   * pixels and left the name nineteen — so every name on the board was an
   * initial and an ellipsis, which is the one thing a leaderboard exists to
   * show. Compact drops the secondary figure and slims the badge slot, and
   * the name gets the width back.
   *
   * A prop rather than a media query, because both surfaces can be on screen
   * at the same viewport width and only their own container knows which is
   * which.
   */
  compact?: boolean;
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

  /**
   * Whether this board has a badge column at all.
   *
   * The slot used to render only on rows whose owner wore something, which
   * meant a board where some players had badges and some did not drew its
   * names at two different x positions — the same ragged left edge the empty
   * podium slot made, one column further in. Reserving it always would put a
   * permanent gutter on boards where nobody wears anything.
   *
   * So it is decided per board, from the rows actually being drawn: present
   * for everyone the moment one player wears something, absent entirely when
   * none do. Both readings stay clean, and the column can never be half there.
   */
  const anyBadge = entries.some((entry) => Boolean(entry.cosmetics?.badge));

  return (
    <ul className={styles.list} data-compact={compact || undefined}>
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
          // Words, because everybody typed the same script: the count alone
          // is comparable in a way it never is on the other boards.
          weekly: { score: entry.words ?? 0, sub: `${entry.wpm} wpm` },
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
            {/*
              * Rank and podium share one cell: a mark for the top three, the
              * number for everybody else.
              *
              * They used to be two cells, and on every board except standings
              * the second one was empty from fourth place down — a dead column
              * running the length of the list that broke the left edge into a
              * ragged stripe. Standings never showed it because a band flame
              * filled the slot for every row, which is exactly why the fault
              * survived: the one board anybody looks at most was the one board
              * it could not appear on.
              *
              * Merged, the cell is always full and always says the same kind of
              * thing — where you came — so the column scans top to bottom on
              * every board. A crown needs no "1" beside it.
              *
              * The height is an exact quarter-scale: the sprite is 68 tall, so
              * 17 lands on whole source pixels. A fraction maps some source
              * rows to two screen pixels and their neighbours to one, which at
              * this size shows as a wobble.
              */}
            <span className={styles.rankPos} data-podium={podium || undefined}>
              {podium
                ? <RankFlame rank={podium} height={17} />
                : <span className="pixel-font">{entry.position}</span>}
            </span>

            {/*
              * The rating band, standings only.
              *
              * Every row on that board has a rating and therefore a band, so
              * this column is never empty there. It is absent entirely
              * elsewhere rather than reserved-and-blank: a flame means a band,
              * and putting one on a board ordered by speed or words invites the
              * reading that it ranks something it does not.
              *
              * Now that the podium mark has its own cell, the top three keep
              * their band here too — which they used to lose, since the crown
              * took the flame's place.
              */}
            {board === 'standings' && (
              <span className={styles.rankFlame}>
                <Flame kind={ratingFlame(rating)} height={19} />
              </span>
            )}

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
            {anyBadge && (
              /* Hover says what the number means. The digits alone are two
                 quiet pixels of provenance; the words are for whoever cares
                 enough to ask. Nothing to say on an empty slot, which is a
                 spacer rather than a control. */
              <span
                className={styles.rankBadge}
                data-tip={entry.cosmetics?.badge ? badgeTooltip(entry.cosmetics) : undefined}
              >
                {entry.cosmetics?.badge && (
                  <>
                    <img src={badgeSrc(entry.cosmetics.badge)} alt="" width={18} height={18} />
                    {/* The founder's position, and only ever theirs. Tiny,
                        because it is provenance rather than a score — the
                        column already has a number that means something else
                        entirely. */}
                    {/* Not in the rail: it is the widest thing this column
                        can hold, and the width it costs comes straight off
                        the name. The hover still says "Founder #47", and the
                        full board still shows the digits. */}
                    {!compact && entry.cosmetics.badgeNumber !== undefined && (
                      <span className={styles.rankBadgeNo}>{entry.cosmetics.badgeNumber}</span>
                    )}
                  </>
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

            {/*
              * Speed, with its unit, everywhere.
              *
              * This went through both wrong answers first. It was hidden in the
              * rail entirely, which lost the figure; then shown as a bare "148",
              * which kept the figure and lost what it meant -- and a lone number
              * next to another lone number is not information, it is a puzzle.
              *
              * The width that made those trades look necessary was not fixed.
              * The name cell tracks the rail at rail minus 212 with the unit
              * spelled out, so the unit is affordable the moment the rail
              * clears 366 pixels; the menu grid had two hundred pixels of its
              * own reserved budget going unspent, and the flanks now take
              * enough of it to make this fit outright. See Game.module.css.
              *
              * Two numbers on one row still have to be told apart, and the
              * styling does that: the score is gold, larger and in the pixel
              * font; this is small and grey. The unit removes the last of the
              * ambiguity rather than a tooltip having to.
              */}
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
