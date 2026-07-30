'use client';

import { ARENA_FX, FX_IDS } from '@/game/arenaFx';
import type { ArenaFxControl } from '@/game/useArenaFx';
import styles from './FxSwitcher.module.css';

/**
 * The badge that says which arena treatment is running.
 *
 * Only on screen when a preset was asked for by URL, so a normal player never
 * meets it. Its whole job is to stop a blind test: flipping between four
 * treatments is useless if you cannot remember which one you are looking at, and
 * "this one feels calmer" is worth nothing without knowing which one "this" was.
 *
 * Deliberately temporary. When one of these wins, this component and everything
 * it reads go in the same commit that makes the winner the default.
 */
export default function FxSwitcher({ fx, cycle, set }: ArenaFxControl) {
  const position = FX_IDS.indexOf(fx.id) + 1;

  return (
    <div className={styles.switcher}>
      <div className={styles.row}>
        {/*
          * mousedown is prevented on every control here.
          *
          * A click would otherwise pull focus off the capture input, which on a
          * phone closes the keyboard and on a desktop stops the duel hearing
          * keystrokes. Losing the duel to change a setting about the duel would
          * make the comparison impossible to run mid-word.
          */}
        <button
          type="button"
          className={styles.step}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => cycle(-1)}
          aria-label="Previous treatment"
        >
          ‹
        </button>

        <span className={`${styles.label} pixel-font`}>{fx.label}</span>

        <button
          type="button"
          className={styles.step}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => cycle(1)}
          aria-label="Next treatment"
        >
          ›
        </button>
      </div>

      <p className={styles.blurb}>{fx.blurb}</p>

      <div className={styles.dots}>
        {FX_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.dot}
            data-active={id === fx.id || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set(id)}
            title={ARENA_FX[id].label}
            aria-label={ARENA_FX[id].label}
          />
        ))}
      </div>

      <small className={styles.hint}>
        {position} of {FX_IDS.length} &middot; F2 to switch, mid duel is fine
      </small>
    </div>
  );
}
