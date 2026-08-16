'use client';

import { useEffect, useRef } from 'react';
import { audio, useKeySound, useSoundEnabled, useVolume } from '@/game/audio';
import { KEY_SOUNDS } from '@/game/keyProfiles';
import { ARENA_FX, SETTINGS_FX, type FxId } from '@/game/arenaFx';
import { useArenaFx } from '@/game/useArenaFx';
import {
  DEFAULT_VIEW, SCRIPT_VIEW_META, SCRIPT_VIEWS, writeScriptView,
} from '@/game/scriptViewPref';
import { usePageAvailable, useScriptViewChoice } from '@/game/useScriptView';
import styles from './Settings.module.css';

/**
 * Everything a player can change about how the game looks and sounds.
 *
 * One sheet rather than the switches this replaces, which had accumulated in
 * three places: a mute in the corner, a keyboard picker behind it, and an
 * arena layout reachable only by knowing to type `?fx=` into the address bar.
 * Two people asked where the wizards had gone, which is the question a
 * settings page exists to stop somebody having to ask on Reddit.
 *
 * **Device-level, deliberately.** These live in localStorage rather than on
 * the account, because they are about this screen and these speakers —
 * unlike cosmetics, which are identity and follow a player everywhere. A
 * phone and a desktop wanting different layouts is normal, not a bug.
 *
 * Defaults are untouched by any of it: sound on, full volume, plain arena. A
 * settings sheet must never change what a new player meets — it exists for
 * the people who go looking.
 */
export default function Settings({ onClose }: { onClose: () => void }) {
  const chosenSound = useKeySound();
  const soundOn = useSoundEnabled();
  const volume = useVolume();
  const { fx, set } = useArenaFx();
  const chosenView = useScriptViewChoice();
  const pageFits = usePageAvailable();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus moves in so arrow keys and Escape land here rather than on
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
        aria-label="Settings"
        // The backdrop closes on click; without this every click inside the
        // dialog would travel up to it and close the thing being used.
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 className={`${styles.heading} pixel-font`}>Settings</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {/* ---------------- Sound ---------------- */}
          <section className={styles.section}>
            <h3 className={`${styles.sectionHeading} pixel-font`}>Sound</h3>

            <div className={styles.row}>
              <span className={styles.rowLabel}>Sound</span>
              <button
                type="button"
                className={styles.switch}
                role="switch"
                aria-checked={soundOn}
                aria-label="Sound"
                onClick={() => audio.setEnabled(!soundOn)}
              >
                {soundOn ? 'On' : 'Muted'}
              </button>
            </div>

            {/* The slider gets its own line with the label above it. Sharing a
                row with a label leaves a phone about half a screen of track,
                which is not enough to place a value with a thumb. */}
            <div className={styles.field} data-dim={!soundOn || undefined}>
              <div className={styles.fieldHead}>
                <label className={styles.rowLabel} htmlFor="volume">Volume</label>
                <span className={styles.rowValue}>{Math.round(volume * 100)}</span>
              </div>
              <input
                id="volume"
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(volume * 100)}
                onChange={(event) => audio.setVolume(Number(event.target.value) / 100)}
                /* A demo on release rather than on every step: dragging a
                   slider that fires a keystroke per pixel is unpleasant, and
                   the point of the sound is to judge the level you settled on. */
                onPointerUp={() => audio.demo(chosenSound)}
                onKeyUp={() => audio.demo(chosenSound)}
              />
            </div>

            {!soundOn && (
              /* Said plainly, because a slider that visibly moves and makes no
                 sound reads as broken rather than as muted. The volume is
                 deliberately still adjustable while muted — it is the level
                 you are choosing for when you come back. */
              <p className={styles.note}>
                Muted, so nothing will play. The volume you set here is kept for
                when you turn sound back on.
              </p>
            )}
          </section>

          {/* ---------------- Keyboard ---------------- */}
          <section className={styles.section}>
            <h3 className={`${styles.sectionHeading} pixel-font`}>Keyboard sound</h3>
            <p className={styles.note}>
              Every keystroke is synthesised, not recorded — these are five shapes
              of the same sound. Pick one to hear it.
            </p>

            <ul className={styles.grid}>
              {KEY_SOUNDS.map((sound) => (
                <li key={sound.id}>
                  {/* Picking and hearing are one action, as they were in the
                      dialog this replaces: nobody knows which of five keyboards
                      they want by reading "rounder and more damped". */}
                  <button
                    type="button"
                    className={styles.tile}
                    data-chosen={sound.id === chosenSound || undefined}
                    aria-pressed={sound.id === chosenSound}
                    aria-label={`${sound.label} — ${sound.blurb}`}
                    onClick={() => {
                      audio.setKeySound(sound.id);
                      audio.demo(sound.id);
                    }}
                  >
                    <span className={styles.tileName}>{sound.label}</span>
                    <span className={styles.tileBlurb}>{sound.blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------------- Arena ---------------- */}
          <section className={styles.section}>
            <h3 className={`${styles.sectionHeading} pixel-font`}>Arena</h3>
            <p className={styles.note}>
              How a duel is drawn. Plain is the default and what most players type
              fastest on; Classic is the original arena, wizards and all.
            </p>

            <ul className={styles.list}>
              {SETTINGS_FX.map((id: FxId) => (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.option}
                    data-chosen={id === fx.id || undefined}
                    aria-pressed={id === fx.id}
                    aria-label={`${ARENA_FX[id].label} — ${ARENA_FX[id].blurb}`}
                    onClick={() => set(id)}
                  >
                    <span className={styles.optionName}>
                      {ARENA_FX[id].label}
                      {id === 'plain' && <span className={styles.tag}>default</span>}
                    </span>
                    <span className={styles.optionBlurb}>{ARENA_FX[id].blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------------- Script ---------------- */}
          <section className={styles.section}>
            <h3 className={`${styles.sectionHeading} pixel-font`}>Script</h3>
            <p className={styles.note}>
              How the words are laid out while you type them. It changes nothing
              about what is typed or scored, so switch whenever you like.
            </p>

            <ul className={styles.list}>
              {SCRIPT_VIEWS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className={styles.option}
                    /*
                     * The stored choice, not the one currently rendering.
                     *
                     * A narrow window falls back to the tape without changing
                     * what is saved — so showing Tape as selected here would
                     * tell somebody their choice had been forgotten, and the
                     * next thing they would do is set it again. The note below
                     * explains the gap instead.
                     */
                    data-chosen={id === (chosenView ?? DEFAULT_VIEW) || undefined}
                    aria-pressed={id === (chosenView ?? DEFAULT_VIEW)}
                    aria-label={`${SCRIPT_VIEW_META[id].label} — ${SCRIPT_VIEW_META[id].blurb}`}
                    onClick={() => writeScriptView(id)}
                  >
                    <span className={styles.optionName}>
                      {SCRIPT_VIEW_META[id].label}
                      {id === DEFAULT_VIEW && <span className={styles.tag}>default</span>}
                    </span>
                    <span className={styles.optionBlurb}>{SCRIPT_VIEW_META[id].blurb}</span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Said only when it applies, and as a fact about the window
                rather than a refusal: nobody on a phone has done anything
                wrong, and the choice is theirs again at a wider size. */}
            {!pageFits && chosenView === 'paragraph' && (
              <p className={styles.note}>
                This window is too narrow for the page, so the tape is showing
                for now. Your choice is kept.
              </p>
            )}
          </section>
        </div>

        {/* Its own bar rather than floating at the end of the scroll: on a
            phone the sheet is taller than the screen, and a Done button that
            has to be scrolled to is one a player looks for at the top. */}
        <div className={styles.foot}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
