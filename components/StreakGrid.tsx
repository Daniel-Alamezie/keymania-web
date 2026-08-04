'use client';

import { useEffect, useRef, useState } from 'react';
import { shareStreakCard } from '@/game/streakCard';
import { cellTip, columns, DAYS, monthLabels, type Streak } from '@/models/streak';
import styles from './StreakGrid.module.css';

/**
 * A year of typing, one square a day.
 *
 * The shape is borrowed openly from a commit calendar, because that shape is
 * already understood: nobody has to be told what a denser column means. What is
 * not borrowed is the look. Squares are hard-edged and set on the game's own
 * gold ramp rather than rounded and green, so it reads as part of KeyMania
 * rather than as a widget lifted from somewhere else.
 *
 * All the arithmetic lives in models/streak.ts. Which column a day falls in and
 * where the months change are the parts that go wrong by exactly one and look
 * entirely plausible on screen, so they are tested rather than eyeballed; this
 * file only draws what it is handed.
 */
export default function StreakGrid({ streak, handle }: {
  streak: Streak | undefined;
  /** Whose streak it is. Absent means no share button: a card with no
      name on it is a picture of nobody. */
  handle?: string;
}) {
  const [sharing, setSharing] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  const scroller = useRef<HTMLDivElement>(null);
  const cols = columns(streak);
  const months = monthLabels(cols);

  /**
   * Opens on today, not on last August.
   *
   * Fifty-three columns do not fit a phone, so the grid scrolls. Left alone it
   * would start at the far end of a year nobody is looking for, and on a narrow
   * screen the current week — the entire point of a streak — would be off the
   * right edge until somebody thought to drag.
   */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [cols.length]);

  if (!streak) return null;

  return (
    <div className={styles.grid}>
      <div className={styles.scroller} ref={scroller}>
        {/* The column count reaches CSS as a custom property, so the track
            definition and the model cannot disagree about how many weeks a
            year has. */}
        <div className={styles.plot} style={{ '--weeks': cols.length } as React.CSSProperties}>
          {/*
            * Months sit above their own column via grid placement rather than
            * absolute offsets, so a label cannot drift away from the week it
            * describes when the square size changes.
            */}
          <div className={styles.months}>
            {months.map(({ week, label }) => (
              <span key={label + week} className={styles.month} style={{ gridColumn: week + 1 }}>
                {label}
              </span>
            ))}
          </div>

          {/*
            * Alternate weekdays only. Seven labels down a column of ten-pixel
            * squares is a wall of text taller than the thing it labels, and the
            * three that are drawn are enough to orient a reader.
            */}
          <div className={styles.days} aria-hidden="true">
            {DAYS.map((day, row) => (
              <span key={day} className={styles.day}>{row % 2 === 0 ? day : ''}</span>
            ))}
          </div>

          <div className={styles.weeks} role="img" aria-label={label(streak)}>
            {cols.map((column, week) => (
              <div key={week} className={styles.week}>
                {column.map((cell, row) => (
                  <span
                    key={row}
                    className={styles.cell}
                    /**
                     * A day nobody played and a day that has not happened are
                     * different, and drawn differently. Without this the grid
                     * tells somebody they missed the rest of this week.
                     */
                    data-level={cell.day === undefined ? undefined : cell.level}
                    data-future={cell.day === undefined || undefined}
                    data-today={cell.day === streak.today || undefined}
                    data-tip={cellTip(cell)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.foot}>
        {/*
          * The key, in the game's own words rather than "Less / More". It is
          * the one place the shades are explained, and a reader who wants the
          * exact band gets it from a square's own tooltip.
          */}
        <div className={styles.key}>
        <span className={styles.keyLabel}>Quiet</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={styles.cell} data-level={level} aria-hidden="true" />
        ))}
          <span className={styles.keyLabel}>Busy</span>
        </div>

        {/*
          * Share, and only once there is something to be proud of.
          *
          * A share button on a blank year is an invitation to post a picture of
          * having done nothing. It appears with the first day and says what it
          * will actually do, which differs by device: a phone hands the picture
          * to the native sheet, a desktop browser saves it.
          */}
        {handle && (streak?.current ?? 0) > 0 && (
          <button
            type="button"
            className={styles.share}
            disabled={sharing === 'busy'}
            onClick={() => {
              setSharing('busy');
              void shareStreakCard({ streak: streak!, handle })
                .then((how) => setSharing(how === 'saved' ? 'saved' : 'idle'))
                .catch(() => setSharing('failed'));
            }}
          >
            {sharing === 'busy' && 'Drawing…'}
            {sharing === 'saved' && 'Saved to your device'}
            {sharing === 'failed' && 'Could not make the image'}
            {sharing === 'idle' && 'Share your streak'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * What a screen reader gets instead of the squares.
 *
 * A summary rather than 371 cells read one at a time, which is what a per-cell
 * label would produce and is unusable. The figures are the point of the grid;
 * the squares are how a sighted reader gets to them quickly.
 */
function label(streak: Streak): string {
  const days = (streak.calendar ?? '').split('').filter((c) => c !== '0').length;
  return `Typing calendar. ${streak.current} day streak, best ${streak.best}. `
    + `${days} days typed on in the last year.`;
}
