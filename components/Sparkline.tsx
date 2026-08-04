/**
 * A trend line with no axes, no labels and no grid.
 *
 * The shape is the whole message: whether somebody is climbing, plateaued or
 * coming back after a gap. Numbers for the endpoints belong beside the chart in
 * the caption row, not inside it — a 250-pixel strip with tick marks on it is a
 * chart that has been asked to do a table's job and does neither.
 *
 * **No charting library.** This is one polyline and a fill. The smallest chart
 * package is around thirty kilobytes for a feature that is nine lines of path
 * arithmetic, on a page whose whole point is to load fast enough that a player
 * clicks a name without thinking about it.
 *
 * **The x-axis is sequence, not time.** Points are evenly spaced whether they
 * span one night or one year. That is not a simplification — it is what keeps
 * the chart publishable: real-time spacing would draw the gaps between somebody's
 * sessions, which is exactly the fact the profile withholds duel history to
 * avoid. See recentWpm in the API, where the series is built with no timestamps
 * for that reason.
 */

'use client';

import { useId } from 'react';

import { H, sparkGeometry, W } from '@/game/sparkline';

export interface SparklineProps {
  /** Values in order, oldest first. */
  points: number[];
  /** Read out to a screen reader in place of the shape. */
  label: string;
  className?: string;
}

export default function Sparkline({ points, label, className }: SparklineProps) {
  /**
   * A genuinely unique id for the gradient.
   *
   * Keying it on the point count was not enough and read as though it were:
   * two charts with the same number of points on one page — the obvious case
   * being a friends board of cards — would generate the same id, and both
   * gradients would resolve to whichever element the browser parsed last.
   *
   * Stripped of punctuation because React's ids look like `:r7:`, and a colon
   * inside a `url(#...)` reference is legal in the attribute but not something
   * every engine's fragment parser is happy with. The prefix keeps it a valid
   * identifier once the colons are gone.
   */
  const gradient = `spark${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  /**
   * No trend to draw: fewer than two duels, so there is nothing a line could
   * honestly say. The caller keeps the caption and drops the chart.
   */
  const geometry = sparkGeometry(points);
  if (!geometry) return null;

  const { line, area, marker } = geometry;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      // Stretches to fill its box: the card decides the width, and a trend
      // line has no aspect ratio worth preserving.
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={area} fill={`url(#${gradient})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        // Constant on screen regardless of how far the viewBox is stretched.
        // Without this, `preserveAspectRatio="none"` scales the stroke with the
        // box and the line thins out as the card gets wider.
        vectorEffect="non-scaling-stroke"
      />
      {/*
        * The newest point, marked. It is the one value the eye is looking for —
        * "where am I now" — and on a line with no axis it is otherwise just the
        * right-hand end of a squiggle.
        *
        * A tick rather than a dot, forced by `preserveAspectRatio="none"`: that
        * stretches the coordinate space horizontally, so a circle renders as an
        * ellipse whose eccentricity depends on how wide the card happens to be.
        * A vertical line is the one mark that survives horizontal scaling
        * unchanged, and with a non-scaling stroke it stays exactly two pixels
        * whatever the width.
        */}
      <line
        x1={marker.x}
        y1={marker.y - 4}
        x2={marker.x}
        y2={marker.y + 4}
        stroke="var(--gold)"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
