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
 * Two things fix that, and they are for two different readers. The count is
 * for somebody scanning: `×4` beside the mark, legible at a glance and without
 * stopping. The list is for somebody who has stopped, and it is the half that
 * makes it feel like a record rather than a score, because "weeks 1, 4, 9 and
 * 10" is a story about a year and "4" is not.
 *
 * **Shown from two upwards.** A `×1` beside every crown is noise, and worse
 * than noise: it turns a first win into a tally, which is precisely the
 * opposite of what a first win should feel like. A single win still gets its
 * week named on hover, from the badge's own tooltip.
 */
export default function CrownWeeks({ weeks, size = 'small' }: {
  weeks: number[] | undefined;
  /** `large` on a profile, where there is room to read; `small` on a row. */
  size?: 'small' | 'large';
}) {
  if (!weeks || weeks.length < 2) return null;

  /**
   * The panel is the profile's alone, and that is a containment decision
   * rather than a taste one.
   *
   * A board row lives inside a scrolling window — see FullBoard's row window —
   * so a panel escaping the row is clipped by it, and a row near the top edge
   * would open onto nothing. The row already answers the same question a
   * different way: its badge carries `badgeTooltip`, which names the weeks in
   * a sentence. Two hover treatments on one mark, one of them clipped, is
   * worse than the one that works everywhere.
   */
  const listed = size === 'large';

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
      {/* No pixel face: the founder number beside it does not use one either,
          and at this size the pixel face measures half again as wide for the
          same two characters — which is the whole margin the slot has. */}
      <span className={styles.count} aria-hidden={listed ? 'true' : undefined}>
        {/* The multiplication sign, not a bare number. Beside a badge that
            already sits next to a founder's position, "3" would read as
            third; "×3" cannot. */}
        ×{weeks.length}
      </span>

      {listed && (
        /*
         * `data-crown-panel` is a handle for the surface around it.
         *
         * The mark somebody reaches for is the crown, not the two characters
         * beside it, and the crown belongs to the profile rather than to this
         * component. That stylesheet opens the panel from its own badge on
         * hover, and needs something stable to name — a hashed class from this
         * module is not it.
         */
        <span className={styles.panel} data-crown-panel aria-hidden="true">
          <span className={styles.panelTitle}>Weekly champion</span>
          <span className={styles.chips}>
            {weeks.map((week) => (
              <span key={week} className={`${styles.chip} pixel-font`}>{week}</span>
            ))}
          </span>
          <span className={styles.panelNote}>
            {weeks.length} weeks won
          </span>
        </span>
      )}
    </span>
  );
}
