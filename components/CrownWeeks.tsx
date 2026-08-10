'use client';

import { championSummary } from '@/models/cosmetics';
import styles from './CrownWeeks.module.css';

/**
 * A crown, and the weeks it took.
 *
 * The crown is granted once however many times somebody wins, so on its own it
 * says "champion" and stops there. A player who has won four weeks and a
 * player who won one in July wear an identical mark, which quietly makes the
 * fourth win worth nothing.
 *
 * Two answers, for two different readers, and they are **not the same rule**.
 *
 * The count is for somebody scanning: `×4` beside the mark, legible without
 * stopping. It needs two wins to mean anything — a `×1` on every crown turns a
 * first win into a tally, which is the opposite of what a first win should
 * feel like.
 *
 * The list is for somebody who has already stopped, and one win is worth
 * naming to them. "Week 1" is the whole of a first champion's record and the
 * only place it is written down; withholding it until a second win would mean
 * the cabinet had nothing to say about the rarest thing in it. Where it
 * appears is decided by room, not by the number of wins.
 */
export default function CrownWeeks({ weeks, size = 'small' }: {
  weeks: number[] | undefined;
  /**
   * `small` on a board row, `large` on a profile heading, `tile` in the
   * collection cabinet. Only the first has no room for a panel.
   */
  size?: 'small' | 'large' | 'tile';
}) {
  if (!weeks || weeks.length === 0) return null;

  const counted = weeks.length > 1;

  /**
   * No panel on a board row, and that is a containment decision rather than a
   * taste one.
   *
   * A row lives inside a scrolling window — see FullBoard's row window — so a
   * panel escaping the row is clipped by it, and a row near the top edge would
   * open onto nothing. The row answers a smaller question a different way: its
   * badge tooltip says "Champion ×4".
   */
  const listed = size !== 'small';

  if (!counted && !listed) return null;

  return (
    /*
     * Focusable only when there is something to open.
     *
     * A popover that answers a mouse alone is a popover a keyboard cannot
     * open, and the information inside it is the reward. `tabIndex` with the
     * summary on `aria-label` gives a screen reader the whole sentence in one
     * go rather than a list of chips to assemble. On a row, where there is no
     * panel, a tab stop would be a stop at nothing.
     */
    <span
      className={styles.wrap}
      data-size={size}
      {...(listed ? { tabIndex: 0, role: 'note', 'aria-label': championSummary(weeks) } : {})}
    >
      {counted && (
        /* No pixel face: the founder number beside it does not use one either,
           and at this size the pixel face measures half again as wide for the
           same two characters — which is the whole margin the slot has. */
        <span className={styles.count} aria-hidden={listed ? 'true' : undefined}>
          {/* The multiplication sign, not a bare number. Beside a badge that
              already sits next to a founder's position, "3" would read as
              third; "×3" cannot. */}
          ×{weeks.length}
        </span>
      )}

      {listed && (
        /*
         * `data-crown-panel` is a handle for the surface around it.
         *
         * The mark somebody reaches for is the crown, and the crown is drawn
         * by the profile rather than by this component. That stylesheet opens
         * the panel from its own badge on hover, and needs something stable to
         * name — a hashed class from this module is not it.
         */
        <span className={styles.panel} data-crown-panel aria-hidden="true">
          {/* Dropped in the cabinet, where the tile below is already captioned
              "Crown" and the width it costs is the width that keeps the panel
              on screen. See the stylesheet. */}
          {size !== 'tile' && <span className={styles.panelTitle}>Weekly champion</span>}
          <span className={styles.chips}>
            {weeks.map((week) => (
              <span key={week} className={`${styles.chip} pixel-font`}>{week}</span>
            ))}
          </span>
          <span className={styles.panelNote}>
            {weeks.length === 1 ? 'won once' : `${weeks.length} weeks won`}
          </span>
        </span>
      )}
    </span>
  );
}
