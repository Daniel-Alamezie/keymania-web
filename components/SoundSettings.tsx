'use client';

import { useEffect, useRef } from 'react';
import { audio, useKeySound, useSoundEnabled } from '@/game/audio';
import { KEY_SOUNDS } from '@/game/keyProfiles';
import styles from './SoundSettings.module.css';

/**
 * Choosing a keyboard.
 *
 * Picking and hearing are the same action. A separate play button next to every
 * row would be the obvious layout and the wrong one: nobody knows which of five
 * keyboards they want by reading "rounder and more damped", so the only way to
 * choose is to hear them one after another — and a preview that does not commit
 * makes you do everything twice. Selecting plays it; if you do not like it, the
 * next click both replaces and plays the next.
 *
 * The demo is a run of presses rather than one, because a single press hides
 * both things worth hearing: no two are quite identical, and the tac brightens
 * as a combo builds.
 */
export default function SoundSettings({ onClose }: { onClose: () => void }) {
  const chosen = useKeySound();
  const soundOn = useSoundEnabled();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus moves in so the arrow keys and Escape land here rather than on
    // whatever was behind the dialog.
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        ref={panel}
        tabIndex={-1}
        className={`panel ${styles.panel}`}
        role="dialog"
        aria-modal="true"
        aria-label="Sound settings"
        // The backdrop closes on click; without this every click inside the
        // dialog would travel up to it and close the thing being used.
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={`${styles.heading} pixel-font`}>Keyboard sound</h2>
        <p className={styles.note}>
          Every keystroke is synthesised, not recorded — these are five different
          shapes of the same sound. Pick one to hear it.
        </p>

        {!soundOn && (
          <p className={styles.warn}>
            Sound is muted, so nothing will play.{' '}
            <button type="button" className={styles.inline} onClick={() => audio.setEnabled(true)}>
              Unmute
            </button>
          </p>
        )}

        <ul className={styles.list}>
          {KEY_SOUNDS.map((sound) => (
            <li key={sound.id}>
              <button
                type="button"
                className={styles.option}
                data-chosen={sound.id === chosen || undefined}
                aria-pressed={sound.id === chosen}
                aria-label={`${sound.label} — ${sound.blurb}`}
                onClick={() => {
                  audio.setKeySound(sound.id);
                  audio.demo(sound.id);
                }}
              >
                {/* Named explicitly because the two spans below have no
                    whitespace between them in the accessibility tree — the
                    computed name came out as "TacCrisp and mid-focused", which
                    is the sort of thing only a screen reader ever discovers. */}
                <span className={styles.optionName}>{sound.label}</span>
                <span className={styles.optionBlurb}>{sound.blurb}</span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className={`btn ${styles.done}`} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
