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
 * The fire behind the path, drawn as pixels.
 *
 * The first version of this was smooth SVG curves, and it was wrong for the
 * game: KeyMania is a pixel game — the keycaps, the badges, the blades and the
 * fighters are all cells on a grid — and an airbrushed flame behind them read
 * as a stock asset borrowed from somewhere else.
 *
 * So it is a bitmap. Three hand-authored frames on an 11×15 grid, three heat
 * bands, and **frame-swapped animation rather than continuous transform**.
 * That last part is what actually carries the feel: pixel art flickers by
 * cutting between drawn frames, and easing a shape smoothly between states is
 * the single thing that makes a pixel sprite look like vector art wearing a
 * costume. The cut is the aesthetic.
 *
 * Authored as strings so the shape can be edited by looking at it. `1` is the
 * outer edge, `2` the body, `3` the core, `.` is nothing — three bands rather
 * than one because a flame reads as hot from the contrast between its edge and
 * its middle, and a single colour at any opacity reads as smoke.
 */
const FRAMES = [
  [
    '.....1.....',
    '....121....',
    '....121....',
    '...12221...',
    '...12321...',
    '..1223221..',
    '..1233221..',
    '.122333221.',
    '.123333321.',
    '12233333221',
    '12333333321',
    '12333333321',
    '.123333321.',
    '.112333211.',
    '..1111111..',
  ],
  [
    '....1......',
    '...121.....',
    '...121.....',
    '...12221...',
    '..1232221..',
    '..1223221..',
    '..1233221..',
    '.122333221.',
    '.123333321.',
    '12233333221',
    '12333333321',
    '12333333321',
    '.123333321.',
    '.112333211.',
    '..1111111..',
  ],
  [
    '......1....',
    '.....121...',
    '.....121...',
    '....12221..',
    '....12321..',
    '...1223221.',
    '..12233221.',
    '.122333221.',
    '.123333321.',
    '12233333221',
    '12333333321',
    '12333333321',
    '.123333321.',
    '.112333211.',
    '..1111111..',
  ],
] as const;

const WIDTH = FRAMES[0][0].length;
const HEIGHT = FRAMES[0].length;

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

const DRAWN = FRAMES.map(cells);

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
      <div className={styles.glow} />

      <svg
        className={styles.flame}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        /* No anti-aliasing. A pixel that has been smoothed is not a pixel. */
        shapeRendering="crispEdges"
      >
        <title>{flameLabel(stage)}</title>
        {DRAWN.map((frame, i) => (
          <g key={i} className={styles.frame}>
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
