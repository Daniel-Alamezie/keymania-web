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
