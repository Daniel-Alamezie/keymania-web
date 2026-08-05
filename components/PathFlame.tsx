'use client';

import { useMemo, type CSSProperties } from 'react';
import {
  flameFrames, flameLabel, SPRITE_FRAMES, SPRITE_H, SPRITE_W, type FlameStage,
} from '@/game/flame';
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
  /**
   * Size to the parent instead of to the viewport.
   *
   * On the ladder this is fixed behind the whole screen, which is why it sizes
   * in viewport units. Anywhere it is being *looked at* rather than sat behind
   * — the bench, mainly — that is wrong: it overflows whatever box it is given
   * and the thing you were trying to inspect is the part that got clipped.
   */
  contained?: boolean;
}

/**
 * The fire behind the path, drawn as pixels.
 *
 * KeyMania is a pixel game — the keycaps, badges, blades and fighters are all
 * cells on a grid — so the flame is a bitmap rather than a smooth curve.
 *
 * The frames come from `flameFrames`, generated from a silhouette function
 * rather than drawn by hand. Three authored frames read as a jitter; eight
 * generated ones read as fire, and the shape stays rounded because the outline
 * follows a curve and only becomes blocky where the grid samples it — which is
 * what pixel art actually is.
 *
 * `1` is the outer edge, `2` the body, `3` the core. Three bands rather than
 * one because a flame reads as hot from the contrast between its edge and its
 * middle, and a single colour at any opacity reads as smoke.
 */
/** Which class paints each band. */
const BAND: Record<string, string> = { 1: styles.outer, 2: styles.mid, 3: styles.core };

/**
 * One frame as a run of rects.
 *
 * Runs rather than one rect per cell: a row of eight identical cells becomes
 * one wide rect, which cuts the node count of the whole sprite by roughly
 * two-thirds. It is the same picture — every edge still lands on a grid line —
 * and it matters because this thing lives behind a scrolling list.
 */
function cells(frame: readonly string[]) {
  const out: { x: number; y: number; w: number; band: string }[] = [];
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const band = row[x];
      if (band === '.') { x += 1; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w] === band) w += 1;
      out.push({ x, y, w, band });
      x += w;
    }
  });
  return out;
}

export default function PathFlame({ heat, stage, offset, contained }: PathFlameProps) {
  /* Regenerated only when the stage changes, which is a handful of times in a
     player's whole life with the feature. */
  const drawn = useMemo(() => flameFrames(stage).map(cells), [stage]);

  return (
    <div
      className={`${styles.wrap}${contained ? ` ${styles.contained}` : ''}`}
      aria-hidden="true"
      data-stage={stage}
      style={{
        '--heat': heat,
        /* Against the scroll and at a fraction of it: the parallax. Negative
           so the flame drifts down as the list travels up, which is what
           reads as distance rather than as a second scrolling layer. */
        '--shift': `${offset * -0.28}px`,
        /* The cycle length is derived, so adding frames never needs a CSS edit. */
        '--frames': SPRITE_FRAMES,
        '--slot': `${100 / SPRITE_FRAMES}%`,
      } as CSSProperties}
    >
      <div className={styles.glow} />

      <svg
        className={styles.flame}
        viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
        preserveAspectRatio="xMidYMid meet"
        /* No anti-aliasing. A pixel that has been smoothed is not a pixel. */
        shapeRendering="crispEdges"
      >
        <title>{flameLabel(stage)}</title>
        {drawn.map((frame, i) => (
          <g
            key={i}
            className={styles.frame}
            style={{ animationDelay: `${(i * 0.72) / SPRITE_FRAMES}s` } as CSSProperties}
          >
            {frame.map((cell) => (
              <rect
                key={`${cell.x}-${cell.y}`}
                className={BAND[cell.band]}
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={1}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
