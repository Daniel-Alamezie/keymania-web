'use client';

import type { CSSProperties } from 'react';
import { flameLabel, type FlameStage } from '@/game/flame';
import styles from './PathFlame.module.css';

export interface PathFlameProps {
  /** 0 to 1, from `flameHeat`. Never 0 in practice — see the spark. */
  heat: number;
  stage: FlameStage;
  /**
   * How far the list beneath has been scrolled, in pixels.
   *
   * The flame moves against it at a fraction of the rate, which is what puts
   * it behind the glass rather than on it. Passed in rather than read here so
   * there is one scroll listener on the screen that owns the scrolling, not a
   * second one guessing at the same numbers.
   */
  offset: number;
}

/**
 * The fire behind the path.
 *
 * Grows with the stars earned, and it is the whole reason the ladder has a
 * background at all: twelve rows of a list is an inventory, and an inventory
 * is not something anybody feels like returning to. The game already talks
 * about stoking the forge and throws embers when a blade lands, so a path that
 * visibly burns hotter as it is walked is the encouragement said in the
 * language the rest of the game already speaks.
 *
 * **Drawn rather than downloaded.** Three overlaid SVG shapes and two
 * keyframes, so it costs nothing on the connection and scales to any screen
 * without a second asset. A looping video would be heavier than the entire
 * rest of this feature.
 *
 * **It is decoration, and behaves like it.** `aria-hidden`, no pointer events,
 * and the stage is announced once in text by the caller rather than being
 * mimed at a screen reader through an animated shape.
 */
export default function PathFlame({ heat, stage, offset }: PathFlameProps) {
  return (
    <div
      className={styles.wrap}
      aria-hidden="true"
      data-stage={stage}
      style={{
        '--heat': heat,
        /* Against the scroll and at a fraction of it: the parallax. Negative
           so the flame drifts down as the list travels up, which is what
           reads as distance rather than as a second scrolling layer. */
        '--shift': `${offset * -0.28}px`,
      } as CSSProperties}
    >
      {/* The glow, which is most of the effect at low heat and all of the
          warmth at high heat. */}
      <div className={styles.glow} />

      <svg className={styles.flame} viewBox="0 0 100 140" preserveAspectRatio="xMidYMax meet">
        <title>{flameLabel(stage)}</title>
        {/* Outer body, inner body, core. Three shapes rather than one, because
            a flame reads as hot from the contrast between its edge and its
            middle — a single colour at any opacity reads as smoke. */}
        <path
          className={styles.outer}
          d="M50 4c14 26 34 38 34 66 0 26-16 44-34 44S16 96 16 70C16 42 36 30 50 4z"
        />
        <path
          className={styles.inner}
          d="M50 34c9 17 21 25 21 43 0 17-10 28-21 28s-21-11-21-28c0-18 12-26 21-43z"
        />
        <path
          className={styles.core}
          d="M50 66c4 8 10 12 10 21 0 8-5 13-10 13s-10-5-10-13c0-9 6-13 10-21z"
        />
      </svg>
    </div>
  );
}
