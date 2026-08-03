'use client';

import { useEffect, useRef } from 'react';
import styles from './RunPause.module.css';

/**
 * The way out of a run, without falling out of one.
 *
 * Escape used to leave immediately — one stray key and a run in progress was
 * gone, back at the menu, with no way to say that was not what you meant.
 * Players reported it. Now it asks.
 *
 * **It does not claim to pause.** The clock and the forge both run on the
 * server, on timestamps this browser does not own, so nothing here can stop
 * them — and an overlay captioned "Paused" over a countdown that is still
 * counting would be the game lying to somebody about the one number they
 * came for. So it says what is actually true, and the run stays visible
 * behind it.
 *
 * Both ways out close the current run before doing anything else. Leaving one
 * open is what produced the older fault where every later attempt was refused
 * with "You are already hosting a duel" — the room outlived the screen.
 */
export default function RunPause({ warning, onResume, onRestart, onExit, restarting }: {
  /** What is still happening while this is on screen. Mode's own words. */
  warning: string;
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  /** A restart has been asked for and the server has not armed it yet. */
  restarting: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus moves in, so the keys a player reaches for next land on the
    // dialog rather than on the run still listening behind it.
    panel.current?.focus();
  }, []);

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        ref={panel}
        tabIndex={-1}
        className={`panel ${styles.panel}`}
        role="dialog"
        aria-modal="true"
        aria-label="Run paused"
      >
        <h2 className={`${styles.heading} pixel-font`}>Still going</h2>
        <p className={styles.warning}>{warning}</p>

        {/*
          * Keep going is first and primary, because it is what most people
          * pressing Escape actually wanted — the other two are the ways out
          * they were previously given without being asked.
          */}
        <button type="button" className="btn btn-primary" onClick={onResume} autoFocus>
          Keep going
        </button>
        <button
          type="button"
          className="btn"
          onClick={onRestart}
          disabled={restarting}
          data-working={restarting || undefined}
        >
          {restarting ? 'Setting up' : 'Start over'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          Back to menu
        </button>

        <p className={styles.shortcut}>
          or hit <kbd className="kbd">ESC</kbd> to keep going
        </p>
      </div>
    </div>
  );
}
