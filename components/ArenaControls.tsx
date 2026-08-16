'use client';

import SoundToggle from './SoundToggle';
import { SCRIPT_VIEW_META, writeScriptView } from '@/game/scriptViewPref';
import { usePageAvailable, useScriptView } from '@/game/useScriptView';
import styles from './ArenaControls.module.css';

/**
 * Tape or page, without leaving the run.
 *
 * In Settings as well, which is where somebody sets a default — but the choice
 * is about how the words read *while typing*, and a setting you can only change
 * from another screen is one you have to guess at. Here it is a keystroke's
 * worth of curiosity instead.
 *
 * **Quiet until reached for**, which is the one place this cluster's own rule
 * bends. The stylesheet next door bans exactly this: the duel's old controls
 * drew no border until hovered, and on a phone — where there is no hover — that
 * left two faint glyphs with nothing to say they could be pressed.
 *
 * That reasoning does not reach this button, because this button is not on a
 * phone. The page needs a screen wide enough to read a paragraph on, so it is
 * not offered below that width and neither is this. Every screen that renders
 * it is a screen with a pointer.
 */
function ScriptToggle() {
  const view = useScriptView();
  const available = usePageAvailable();

  /* No room for the page here, so no choice to offer. */
  if (!available) return null;

  const next = view === 'tape' ? 'paragraph' : 'tape';

  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${styles.quiet}`}
      onClick={() => writeScriptView(next)}
      /* Says what it is *and* what pressing it does. A toggle showing only its
         own state leaves somebody guessing which way it goes. */
      aria-label={`Script: ${SCRIPT_VIEW_META[view].label.toLowerCase()}. Switch to ${SCRIPT_VIEW_META[next].label.toLowerCase()}.`}
      title={`Switch to ${SCRIPT_VIEW_META[next].label.toLowerCase()}`}
    >
      {/*
        * Drawn rather than lettered, and drawn as the thing itself: one bar
        * running off both edges is the tape, three stacked is the page. It
        * shows the mode you are *in*, so the control reads as a state and not
        * as a button that does something unknown.
        */}
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        {view === 'tape' ? (
          <rect x="-2" y="7" width="20" height="2.4" fill="currentColor" />
        ) : (
          <>
            <rect x="2" y="3" width="12" height="2" fill="currentColor" opacity="0.45" />
            <rect x="2" y="7" width="12" height="2" fill="currentColor" />
            <rect x="2" y="11" width="8" height="2" fill="currentColor" opacity="0.45" />
          </>
        )}
      </svg>
    </button>
  );
}

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
      {/* First in the row, furthest from the way out. The two that change
          nothing sit together; the one that ends a run stays on its own end. */}
      <ScriptToggle />
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
