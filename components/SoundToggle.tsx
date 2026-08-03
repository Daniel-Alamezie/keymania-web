'use client';

import { useEffect } from 'react';
import { audio, useSoundEnabled } from '@/game/audio';
import PixelSprite from './PixelSprite';
import styles from './SoundToggle.module.css';

/**
 * Ctrl+M, everywhere.
 *
 * A bare letter cannot work: mid-duel every printable key is a keystroke in the
 * word you are typing, and this is a game where reaching for the mouse costs
 * you the round. The duel's own key handler already ignores anything held with
 * a modifier, so this slips past it without a special case.
 */
export function useSoundHotkey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'm') return;
      event.preventDefault();
      audio.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** What counts as clickable enough to answer the cursor. */
const INTERACTIVE = 'button, a[href], [role="button"]';

/** A control you cannot press should not sound like one you can. */
function pressable(control: Element): boolean {
  if ((control as HTMLButtonElement).disabled) return false;
  return control.getAttribute('aria-disabled') !== 'true';
}

/**
 * A soft note under the cursor and a press when it goes down, everywhere.
 *
 * Delegated listeners rather than handlers on every control. There are buttons
 * in the menu, the lobby, the guide, the account bar and the result screen, and
 * wiring each one by hand would mean every future button silently arriving
 * without a sound — the kind of gap nobody notices until the polish looks
 * uneven.
 *
 * Delegation is why hover listens for mouseover rather than mouseenter, which
 * does not bubble and so cannot be delegated at all.
 */
export function useUiSounds() {
  useEffect(() => {
    /**
     * Hover is for pointers only: a touch browser fires a synthetic mouseover
     * immediately before the click, so on a phone every tap would answer twice.
     *
     * Only the hover listener is gated on this. A tap is a real pointerdown and
     * deserves its click — an earlier version returned early here and left
     * touch devices with no press sound at all.
     */
    const canHover = window.matchMedia?.('(hover: hover)').matches ?? false;

    let previous: Element | null = null;

    const onOver = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const control = target?.closest?.(INTERACTIVE) ?? null;

      // mouseover fires again for every child element, so the icon and the
      // label inside a button would each retrigger it as the cursor crosses
      // them. Only a change of control is a new hover.
      if (control === previous) return;
      previous = control;

      if (!control || !pressable(control)) return;
      audio.hover();
    };

    /**
     * On press, not on release.
     *
     * A UI that answers when the button goes down feels like a physical thing;
     * one that waits for the mouse to come back up feels like it is thinking
     * about it. This doubles as the gesture that starts the AudioContext, which
     * hovering is not allowed to do.
     */
    const onDown = (event: PointerEvent) => {
      audio.unlock();
      const control = (event.target as Element | null)?.closest?.(INTERACTIVE);
      if (!control || !pressable(control)) return;
      audio.click();
    };

    /**
     * Keyboard activation of a focused control.
     *
     * A real mouse click carries detail >= 1; one synthesised from Enter or
     * Space carries 0. Testing it is what lets both routes make a sound without
     * a mouse press being answered twice, once here and once on pointerdown.
     */
    const onClick = (event: MouseEvent) => {
      if (event.detail !== 0) return;
      const control = (event.target as Element | null)?.closest?.(INTERACTIVE);
      if (!control || !pressable(control)) return;
      audio.click();
    };

    if (canHover) document.addEventListener('mouseover', onOver);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('click', onClick);
    return () => {
      if (canHover) document.removeEventListener('mouseover', onOver);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('click', onClick);
    };
  }, []);
}

/**
 * Sound on or off.
 *
 * Reachable from the menu and the lobby, not only from inside a duel — muting
 * used to mean starting a match first, which is the wrong order for someone
 * sitting down in a quiet room.
 */
export default function SoundToggle({ className, onSettings }: {
  className?: string;
  /**
   * Opens the settings sheet. Omitted where there is nowhere to put a dialog —
   * mid-duel, the last thing anybody needs is a modal over the arena.
   */
  onSettings?: () => void;
}) {
  const on = useSoundEnabled();

  return (
    <div className={`${styles.cluster} ${className ?? ''}`}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => audio.toggle()}
        aria-pressed={!on}
        aria-label={on ? 'Mute sound' : 'Unmute sound'}
        title={`${on ? 'Mute' : 'Unmute'} sound (Ctrl+M)`}
      >
        <PixelSprite name={on ? 'sound-on' : 'sound-off'} height={16} />
      </button>

      {onSettings && (
        <button
          type="button"
          className={styles.toggle}
          onClick={onSettings}
          aria-label="Settings"
          title="Choose a keyboard sound"
        >
          <PixelSprite name="settings" height={16} />
        </button>
      )}
    </div>
  );
}
