'use client';

import { useState } from 'react';
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
const PAD = { top: 12, right: 12, bottom: 20, left: 28 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** Never let the band collapse when every duel came out the same speed. */
const MIN_RANGE = 10;

interface Props {
  /** Oldest first. */
  points: ChartPoint[];
  className?: string;
}

interface Placed extends ChartPoint {
  /** Position along the shared timeline, so both lines share one x axis. */
  index: number;
  x: number;
  y: number;
}

/**
 * Speed across recent duels.
 *
 * Two lines rather than one: duels against other players and practice against
 * bots are different things measured the same way, and a single line mixing
 * them implies a trend that is really two. They share one x axis — the order
 * the duels happened in — so you can still read them against each other.
 *
 * Hand-rolled rather than pulled from a charting library: the whole visual
 * language here is square edges and hard pixels, which is the one thing chart
 * libraries are built to smooth away.
 *
 * The y-axis is zoomed to the data rather than anchored at zero. Anchoring at
 * zero is the honest default for comparing magnitudes, but this chart answers
 * "am I getting faster?", and a 15 wpm improvement is invisible on a 0-100
 * axis. The axis is labelled with its real bounds so the zoom is never hidden.
 */
export default function WpmChart({ points, className }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

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

  const xFor = (i: number) =>
    points.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i * PLOT_W) / (points.length - 1);
  const yFor = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  const placed: Placed[] = points.map((p, index) => ({
    ...p, index, x: xFor(index), y: yFor(p.wpm),
  }));

  // Each line joins only its own kind, but keeps its place on the shared
  // timeline — so a gap in one line is a stretch where you played the other.
  const ranked = placed.filter((p) => p.ranked);
  const practice = placed.filter((p) => !p.ranked);

  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const latest = placed[placed.length - 1];
  const active = hovered === null ? null : placed[hovered];

  const path = (list: Placed[]) => list.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <figure className={`${styles.wrap} ${className ?? ''}`}>
      <div className={styles.plot}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={
            `Speed across the last ${points.length} duels, ` +
            `from ${rawLo} to ${rawHi} words per minute, averaging ${Math.round(average)}.`
          }
          onMouseLeave={() => setHovered(null)}
        >
          {/* Horizontal guides at the band edges and the middle. */}
          {[lo, Math.round((lo + hi) / 2), hi].map((v) => (
            <g key={v}>
              <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={yFor(v)} y2={yFor(v)} />
              <text className={styles.axis} x={PAD.left - 5} y={yFor(v) + 3} textAnchor="end">{v}</text>
            </g>
          ))}

          {/* The mean across everything, so one fast run is not read as a trend. */}
          <line
            className={styles.average}
            x1={PAD.left} x2={W - PAD.right}
            y1={yFor(average)} y2={yFor(average)}
          />

          {practice.length > 1 && <polyline className={styles.linePractice} points={path(practice)} />}
          {ranked.length > 1 && <polyline className={styles.lineRanked} points={path(ranked)} />}

          {/* Square markers, not circles — this is a pixel-art game. */}
          {placed.map((p) => (
            <rect
              key={p.at}
              className={styles.dot}
              data-ranked={p.ranked || undefined}
              data-active={p.index === hovered || undefined}
              x={p.x - 2.5} y={p.y - 2.5} width={5} height={5}
            />
          ))}

          {/* A sparkle on the duel you just played, so it is findable in a wall
              of identical squares. Three frames cycled in CSS, like the torches. */}
          <g className={styles.latest} transform={`translate(${latest.x - 6.5} ${latest.y - 6.5})`}>
            {[1, 2, 3].map((frame) => (
              <image
                key={frame}
                className={styles.latestFrame}
                href={`/sprites/marker-${frame}.png`}
                width={13} height={13}
              />
            ))}
          </g>

          {/* Generous invisible hit areas — a 5px square is not a pointer
              target, and on the shared axis the columns never overlap. */}
          {placed.map((p) => (
            <rect
              key={`hit-${p.at}`}
              className={styles.hit}
              x={p.x - PLOT_W / (points.length * 2) - 2}
              y={PAD.top}
              width={PLOT_W / points.length + 4}
              height={PLOT_H}
              tabIndex={0}
              role="button"
              aria-label={describe(p)}
              onMouseEnter={() => setHovered(p.index)}
              onFocus={() => setHovered(p.index)}
              onBlur={() => setHovered(null)}
            />
          ))}
        </svg>

        {active && (
          <div
            className={styles.tip}
            // Positioned as a percentage of the viewBox so it tracks the point
            // through every scale the chart is rendered at.
            style={{ left: `${(active.x / W) * 100}%`, top: `${(active.y / H) * 100}%` }}
            data-flip={active.x > W * 0.6 || undefined}
            role="status"
          >
            <span className={`${styles.tipWpm} pixel-font`}>{active.wpm} wpm</span>
            <span className={styles.tipMeta} data-won={active.won || undefined}>
              {active.won ? 'Won' : 'Lost'} · {active.ranked ? 'player' : 'bot'}
            </span>
            <span className={styles.tipWhen}>{when(active.at)}</span>
          </div>
        )}
      </div>

      <figcaption className={styles.legend}>
        <span className={styles.key} data-series="ranked">Versus players</span>
        <span className={styles.key} data-series="practice">Versus bots</span>
        <span className={styles.avgKey}>Average {Math.round(average)} wpm</span>
      </figcaption>
    </figure>
  );
}

const describe = (p: Placed) =>
  `${p.wpm} words per minute, ${p.won ? 'won' : 'lost'}, against ${p.ranked ? 'a player' : 'a bot'}.`;

/** Relative, because "3 days ago" is what a player actually wants to know. */
function when(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}
