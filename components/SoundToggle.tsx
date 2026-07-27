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

/**
 * A soft note under the cursor, everywhere.
 *
 * One delegated listener rather than an onMouseEnter on every control. There
 * are buttons in the menu, the lobby, the guide, the account bar and the result
 * screen, and wiring each one by hand would mean every future button silently
 * arriving without a sound — the kind of gap nobody notices until the polish
 * looks uneven.
 *
 * Delegation is why this listens for mouseover rather than mouseenter, which
 * does not bubble and so cannot be delegated at all.
 */
export function useHoverSound() {
  useEffect(() => {
    // Pointer devices only. A touch browser fires a synthetic mouseover
    // immediately before the click, so on a phone every tap would answer twice.
    if (!window.matchMedia?.('(hover: hover)').matches) return;

    let previous: Element | null = null;

    const onOver = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const control = target?.closest?.(INTERACTIVE) ?? null;

      // mouseover fires again for every child element, so the icon and the
      // label inside a button would each retrigger it as the cursor crosses
      // them. Only a change of control is a new hover.
      if (control === previous) return;
      previous = control;

      if (!control) return;
      // A control you cannot press should not sound like one you can.
      if ((control as HTMLButtonElement).disabled) return;
      if (control.getAttribute('aria-disabled') === 'true') return;

      audio.hover();
    };

    // Hovering cannot start an AudioContext — browsers grant that only to real
    // gestures — so the first press of anything wakes the engine and every
    // hover after it is audible.
    const onDown = () => audio.unlock();

    document.addEventListener('mouseover', onOver);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('pointerdown', onDown);
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
export default function SoundToggle({ className }: { className?: string }) {
  const on = useSoundEnabled();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${className ?? ''}`}
      onClick={() => audio.toggle()}
      aria-pressed={!on}
      aria-label={on ? 'Mute sound' : 'Unmute sound'}
      title={`${on ? 'Mute' : 'Unmute'} sound (Ctrl+M)`}
    >
      <PixelSprite name={on ? 'sound-on' : 'sound-off'} height={16} />
    </button>
  );
}
