'use client';

import { SCRIPT_VIEW_META, writeScriptView } from '@/game/scriptViewPref';
import { usePageAvailable, useScriptView } from '@/game/useScriptView';
import styles from './ScriptSwitch.module.css';

/**
 * Tape or page, switched without leaving the run.
 *
 * Settings is where a default belongs and it is the wrong place to *discover*
 * this: the choice is about how the words read while typing, and a setting
 * reachable only from another screen is one you have to already know about.
 *
 * **A switch rather than an icon, and the difference is the text.** It began as
 * a single glyph beside the speaker, which said "something about lines" and
 * nothing about what pressing it would do. A track with a knob says there are
 * two positions and you are in one of them; the word says which; the mark says
 * what that looks like. Somebody who has never seen it before can read all
 * three in one glance, which a glyph alone never managed.
 *
 * Not `role="switch"`. That announces "on" and "off", and these are two named
 * modes rather than a thing being enabled — a screen reader saying "page, off"
 * would be describing a state that does not exist. A button whose label states
 * where you are and what happens next says the true thing.
 */
export default function ScriptSwitch({ className }: {
  /** The arena's own positioning. Appearance is decided here, place is not. */
  className?: string;
}) {
  const view = useScriptView();
  const available = usePageAvailable();

  /* No room for the page here, so no choice to offer. */
  if (!available) return null;

  const page = view === 'paragraph';
  const next = page ? 'tape' : 'paragraph';

  return (
    <button
      type="button"
      className={`${styles.chip} ${className ?? ''}`}
      data-view={view}
      onClick={() => writeScriptView(next)}
      aria-label={`Script: ${SCRIPT_VIEW_META[view].label.toLowerCase()}. Switch to ${SCRIPT_VIEW_META[next].label.toLowerCase()}.`}
      title={`Switch to ${SCRIPT_VIEW_META[next].label.toLowerCase()}`}
    >
      <span className={styles.track} aria-hidden="true">
        {/*
          * The knob carries the mark, so the thing that moves is also the thing
          * that says what you get. A static icon beside a moving knob would be
          * two separate claims about one state.
          */}
        <span className={styles.knob}>
          <svg viewBox="0 0 12 12" width="9" height="9" focusable="false">
            {page ? (
              <>
                <rect x="1" y="2" width="10" height="1.6" fill="currentColor" opacity="0.5" />
                <rect x="1" y="5.2" width="10" height="1.6" fill="currentColor" />
                <rect x="1" y="8.4" width="7" height="1.6" fill="currentColor" opacity="0.5" />
              </>
            ) : (
              /* Running off both edges, because that is what the tape does. */
              <rect x="-2" y="5.2" width="16" height="1.6" fill="currentColor" />
            )}
          </svg>
        </span>
      </span>

      <span className={`${styles.label} pixel-font`}>{SCRIPT_VIEW_META[view].label}</span>
    </button>
  );
}
