'use client';

import { BOARDS, LAYOUT_IDS, type LayoutId } from '@/game/keyboard';
import RetroKeyboard from './RetroKeyboard';
import styles from './LayoutPicker.module.css';

/**
 * Which keyboard the player is actually sitting at.
 *
 * Not a cosmetic setting, which is why it earns a real control rather than a
 * line in a menu somewhere. `"` is Shift+`'` on a US board and Shift+`2` on a
 * UK one, so getting this wrong makes the path name the wrong finger with
 * complete confidence, on the module whose whole subject is which finger to
 * use. A learner has no way to know it is wrong; they just build the habit.
 *
 * The board is drawn rather than only named, because "ANSI" and "ISO" are
 * words somebody has to already know, and the shape of the key beside Enter is
 * something anybody can check against the keyboard under their hands.
 */

export interface LayoutPickerProps {
  current: LayoutId;
  onChoose: (layout: LayoutId) => void;
  /** What the browser worked out by itself, where it could. */
  detected?: LayoutId;
  /** Saving to the account, so the control can go quiet for a moment. */
  busy?: boolean;
}

/** The tell, in the words somebody can check without knowing any jargon. */
const TELL: Record<LayoutId, string> = {
  us: 'Long Enter, and \\ sits above it',
  uk: 'Tall Enter, and " is on the 2',
};

export default function LayoutPicker({
  current, onChoose, detected, busy = false,
}: LayoutPickerProps) {
  return (
    <div className={styles.picker}>
      <div className={styles.options}>
        {LAYOUT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.option}
            data-on={id === current || undefined}
            aria-pressed={id === current}
            disabled={busy}
            onClick={() => onChoose(id)}
          >
            <span className={styles.name}>{BOARDS[id].label}</span>
            <span className={styles.detail}>{TELL[id]}</span>
          </button>
        ))}
      </div>

      <div className={styles.preview}>
        {/* No hands: this is a question about the board, and two hands resting
            on it would be answering a different one. */}
        <RetroKeyboard layout={current} hands={false} width={520} />
      </div>

      {detected && detected !== current && (
        <p className={styles.note}>
          Your browser thinks this machine has a {BOARDS[detected].label} board.
          Keep your choice if you know better; it is only a guess.
        </p>
      )}
    </div>
  );
}
