'use client';

import SoundToggle from './SoundToggle';
import styles from './ArenaControls.module.css';

/**
 * Sound, and the way out. The same pair, in the same place, in every mode.
 *
 * There were three copies of this: survival's, the duel's, and weekly's — which
 * was survival's, borrowed by importing another component's stylesheet, and the
 * reason nobody noticed the drift was that two of the three did happen to
 * match. The duel's had wandered furthest: borderless until hovered, half
 * opaque, and pinned to the middle of the right edge, where it read as
 * something floating over the arena rather than part of the interface.
 *
 * A player moving between survival, a sprint and a duel should not have to
 * find these again each time. One component, one stylesheet, and the arenas
 * say only where it goes.
 */
export default function ArenaControls({ onLeave, leaveLabel, leaveTitle, className }: {
  /**
   * Absent hides the button entirely, which is what a finished duel wants:
   * there is nothing left to forfeit, and offering to quit over the top of
   * the result undercuts it.
   */
  onLeave?: () => void;
  /** What leaving means here: a run, a sprint, a duel. */
  leaveLabel: string;
  /** Only where there is a shortcut worth naming. */
  leaveTitle?: string;
  /** The arena's own positioning. See the note in the stylesheet. */
  className?: string;
}) {
  return (
    <div className={`${styles.controls} ${className ?? ''}`}>
      {/*
        * No class passed. SoundToggle applies whatever it is given to the
        * wrapper *around* its button, not to the button, and that button
        * already draws its own box — so handing it the leave button's styling
        * put a second border around the first. See the note in the stylesheet.
        */}
      <SoundToggle />
      {onLeave && (
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onLeave}
          aria-label={leaveLabel}
          title={leaveTitle}
        >
          {/*
            * Hidden from the reader: the button already says what it does
            * through its label, and a screen reader announcing "multiplication
            * sign, leave the run" is one word of noise on a control somebody
            * is reaching for in a hurry.
            */}
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}
