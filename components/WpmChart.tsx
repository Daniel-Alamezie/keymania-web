'use client';

import styles from './WpmChart.module.css';

export interface ChartPoint {
  wpm: number;
  at: number;
  ranked: boolean;
  won: boolean;
}

/** Drawn in a fixed coordinate space and scaled by CSS — the SVG equivalent of
 *  authoring pixel art small and upscaling it. */
const W = 320;
const H = 130;
const PAD = { top: 12, right: 10, bottom: 20, left: 28 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Never let the band collapse when every duel came out the same speed. */
const MIN_RANGE = 10;

interface Props {
  points: ChartPoint[];
  /** Oldest first. */
  className?: string;
}

/**
 * Speed across recent duels.
 *
 * Hand-rolled rather than pulled from a charting library: the whole visual
 * language here is square edges and hard pixels, which is the one thing chart
 * libraries are built to smooth away. It is also ~100 lines against ~50kb of
 * dependency.
 *
 * The y-axis is zoomed to the data rather than anchored at zero. Anchoring at
 * zero is the honest default for comparing magnitudes, but this chart answers
 * "am I getting faster?", and a 15 wpm improvement is invisible on a 0-100
 * axis. The axis is labelled with its real bounds so the zoom is never hidden.
 */
export default function WpmChart({ points, className }: Props) {
  if (points.length === 0) {
    return (
      <p className={styles.empty}>
        No duels recorded yet. Your speed over time will chart here.
      </p>
    );
  }

  const values = points.map((p) => p.wpm);
  const rawLo = Math.min(...values);
  const rawHi = Math.max(...values);

  // Pad the band so the fastest and slowest runs are not welded to the frame.
  const mid = (rawLo + rawHi) / 2;
  const span = Math.max(rawHi - rawLo, MIN_RANGE);
  const lo = Math.max(0, Math.floor(mid - span * 0.75));
  const hi = Math.ceil(mid + span * 0.75);

  const x = (i: number) =>
    points.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i * PLOT_W) / (points.length - 1);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  const line = points.map((p, i) => `${x(i)},${y(p.wpm)}`).join(' ');
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;

  return (
    <figure className={`${styles.wrap} ${className ?? ''}`}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          `Speed across the last ${points.length} duels, ` +
          `from ${rawLo} to ${rawHi} words per minute, averaging ${Math.round(average)}.`
        }
      >
        {/* Horizontal guides at the band edges and the middle. */}
        {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
          <g key={v}>
            <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text className={styles.axis} x={PAD.left - 5} y={y(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}

        {/* The player's mean, so a single fast run is not mistaken for a trend. */}
        <line
          className={styles.average}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(average)}
          y2={y(average)}
        />

        <polyline className={styles.line} points={line} />

        {/* Square markers, not circles — this is a pixel-art game. Ranked duels
            are gold; bot practice is muted, so the graph never pretends a
            practice run counted for the standings. */}
        {points.map((p, i) => (
          <rect
            key={p.at}
            className={styles.dot}
            data-ranked={p.ranked || undefined}
            x={x(i) - 2.5}
            y={y(p.wpm) - 2.5}
            width={5}
            height={5}
          />
        ))}
      </svg>

      <figcaption className={styles.legend}>
        <span className={styles.key} data-ranked>Ranked duel</span>
        <span className={styles.key}>Bot practice</span>
        <span className={styles.avgKey}>Average {Math.round(average)} wpm</span>
      </figcaption>
    </figure>
  );
}
