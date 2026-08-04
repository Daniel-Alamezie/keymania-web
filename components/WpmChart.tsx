'use client';

import { useId, useMemo, useState } from 'react';
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

/**
 * Pointer target around each node, in chart units.
 *
 * Bigger than the 5px marker so it can actually be hit, small enough that it
 * stays *on* the node — the reading should appear because you pointed at a
 * duel, not because you were vaguely near one.
 */
const HIT = 14;

/**
 * How many duels are plotted at once.
 *
 * Applied *after* filtering, which is the whole reason the toggle earns its
 * place: on "both", twenty duels of a mixed record can easily be twenty
 * practice runs and no ranked line at all, because the window is chronological
 * rather than per-series. Narrowing to one kind gives that kind the full twenty
 * and a history worth reading.
 */
const WINDOW = 20;

const VIEWS = [
  { key: 'all', label: 'Both' },
  { key: 'ranked', label: 'Players' },
  { key: 'practice', label: 'Bots' },
] as const;

type View = (typeof VIEWS)[number]['key'];

interface Props {
  /**
   * Every duel worth charting, oldest first.
   *
   * The whole history rather than a pre-cut window: the chart decides what to
   * show, and it cannot honour a filter over points that were discarded before
   * they arrived.
   */
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
  const rawId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [view, setView] = useState<View>('all');

  const visible = useMemo(() => {
    const kept = view === 'all'
      ? points
      : points.filter((p) => p.ranked === (view === 'ranked'));
    // slice(-n), not slice(0, n): the input is oldest first, and the window is
    // the most recent duels.
    return kept.slice(-WINDOW);
  }, [points, view]);

  const chooser = (
    <div className={styles.views} role="group" aria-label="Which duels to chart">
      {VIEWS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={styles.view}
          data-active={view === key || undefined}
          aria-pressed={view === key}
          // The hover reading is an index into the visible set, so it means
          // something different the moment that set changes.
          onClick={() => { setView(key); setHovered(null); }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (visible.length === 0) {
    return (
      <div className={`${styles.wrap} ${className ?? ''}`}>
        {chooser}
        <p className={styles.empty}>
          {points.length === 0
            ? 'No duels recorded yet. Your speed over time will chart here.'
            : view === 'ranked'
              ? 'No duels against other players yet. Beat someone and this fills in.'
              : 'No practice against bots yet.'}
        </p>
      </div>
    );
  }

  const values = visible.map((p) => p.wpm);
  const rawLo = Math.min(...values);
  const rawHi = Math.max(...values);

  // Pad the band so the fastest and slowest runs are not welded to the frame.
  const mid = (rawLo + rawHi) / 2;
  const span = Math.max(rawHi - rawLo, MIN_RANGE);
  const lo = Math.max(0, Math.floor(mid - span * 0.75));
  const hi = Math.ceil(mid + span * 0.75);

  const xFor = (i: number) =>
    visible.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i * PLOT_W) / (visible.length - 1);
  const yFor = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  const placed: Placed[] = visible.map((p, index) => ({
    ...p, index, x: xFor(index), y: yFor(p.wpm),
  }));

  // Each line joins only its own kind, but keeps its place on the shared
  // timeline — so a gap in one line is a stretch where you played the other.
  const ranked = placed.filter((p) => p.ranked);
  const practice = placed.filter((p) => !p.ranked);

  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const latest = placed[placed.length - 1];
  const active = hovered === null ? null : placed[hovered];
  // Stripped of punctuation: React's ids look like `:r7:`, and a colon inside a
  // url(#...) reference is legal in the attribute but not something every
  // engine's fragment parser is happy with.
  const gid = `wpm${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  /**
   * The points as a smooth curve rather than a chain of straight segments.
   *
   * A monotone cubic: each control point is derived from the *neighbouring*
   * points, and the handles are clamped so the curve can never rise above a
   * local maximum or dip below a local minimum. That clamp is the whole reason
   * to write this by hand rather than reach for a plain cardinal spline, which
   * overshoots — and an overshoot on this chart draws a speed the player never
   * typed, between two duels where they typed something slower.
   *
   * The result reads as a trend instead of a graph, which is the point: the
   * exact figures live in the hover, and the shape is what the eye is for.
   */
  const curve = (list: Placed[]) => {
    if (list.length < 2) return '';
    const d = [`M${list[0].x},${list[0].y}`];

    for (let i = 0; i < list.length - 1; i += 1) {
      const p0 = list[i - 1] ?? list[i];
      const p1 = list[i];
      const p2 = list[i + 1];
      const p3 = list[i + 2] ?? p2;

      // A sixth of the neighbour span: the standard Catmull-Rom to Bezier
      // conversion, tightened so the curve hugs its points on a chart this
      // dense rather than billowing between them.
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;

      // Vertical handles are flattened at a turning point, which is what stops
      // the overshoot: if this point is a peak or a trough relative to its
      // neighbours, the curve leaves and arrives level.
      const turn = (a: number, b: number, c: number) => ((b - a) * (c - b) <= 0 ? 0 : (c - a) / 6);
      const c1y = p1.y + turn(p0.y, p1.y, p2.y);
      const c2y = p2.y - turn(p1.y, p2.y, p3.y);

      d.push(`C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`);
    }

    return d.join(' ');
  };

  /**
   * The same line, closed down to the floor so the area under it can be washed.
   *
   * Drawn as its own path rather than by filling the polyline, which would
   * shade the area *above* a descending run and read as a different chart
   * entirely — the same trap the profile sparkline documents.
   *
   * A series with a gap in it (you played bots for a week) still closes across
   * the gap, because the fill is a backdrop for the line rather than a claim
   * about the days in between. The line itself is what carries the reading.
   */
  const area = (list: Placed[]) => {
    if (list.length < 2) return '';
    const floor = H - PAD.bottom;
    // Built from the curve so the wash and the line share an edge exactly. Two
    // different shapes here leaves a hairline of background between them.
    return `M${list[0].x},${floor} L${curve(list).slice(1)} L${list.at(-1)!.x},${floor} Z`;
  };

  return (
    <figure className={`${styles.wrap} ${className ?? ''}`}>
      {chooser}
      <div className={styles.plot}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={
            `Speed across the last ${visible.length} duels, ` +
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

          {/*
            * Gradients keyed on the chart's own id, so two charts on one page
            * cannot collide and resolve to whichever the browser parsed last.
            */}
          <defs>
            <linearGradient id={`${gid}-ranked`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${gid}-practice`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cool, #6fd7ff)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--cool, #6fd7ff)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/*
            * The wash goes under both lines, and both washes go under both
            * lines: drawn interleaved, the ranked fill would sit on top of the
            * practice line and mute it wherever the two overlap.
            */}
          {practice.length > 1 && (
            <path className={styles.area} d={area(practice)} fill={`url(#${gid}-practice)`} />
          )}
          {ranked.length > 1 && (
            <path className={styles.area} d={area(ranked)} fill={`url(#${gid}-ranked)`} />
          )}

          {practice.length > 1 && <path className={styles.linePractice} d={curve(practice)} fill="none" pathLength={1} />}
          {ranked.length > 1 && <path className={styles.lineRanked} d={curve(ranked)} fill="none" pathLength={1} />}

          {/*
            * One marker, on the duel being read, rather than a square on every
            * point.
            *
            * Thirty markers turned the line into a dotted rule and buried the
            * shape under its own data, which is what the curve above exists to
            * show. Only the point under the pointer is drawn now.
            *
            * Nothing about hovering changed: the targets were never these
            * squares. They are the invisible `.hit` rects further down, which
            * are already larger than a marker ever was and sit on the nodes
            * rather than spanning their columns — a decision that comment
            * records and this does not disturb.
            */}
          {active && (
            <rect
              className={styles.dot}
              data-ranked={active.ranked || undefined}
              data-active
              x={active.x - 2.5} y={active.y - 2.5} width={5} height={5}
            />
          )}

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

          {/* Hit areas sit on the nodes themselves, not their whole column.
              Column-wide targets meant hovering empty space anywhere above or
              below a point popped its reading up, which reads as the chart
              guessing at what you meant. Still larger than the 5px square, so
              it is a real pointer target. */}
          {placed.map((p) => (
            <rect
              key={`hit-${p.at}`}
              className={styles.hit}
              x={p.x - HIT / 2}
              y={p.y - HIT / 2}
              width={HIT}
              height={HIT}
              onMouseEnter={() => setHovered(p.index)}
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

      {/* The readings, for anyone not using a pointer.
          These used to hang off the hit areas as aria-labels, which meant they
          only existed while those were focusable — and an SVG rect fires no
          focus events even when the browser reports it focused, so that was a
          promise the chart could not keep. A plain list always can. */}
      <ul className={styles.srOnly}>
        {placed.map((p) => <li key={`read-${p.at}`}>{describe(p)}</li>)}
      </ul>

      {/* Only the series actually on screen. The legend used to name both
          whatever was drawn, so a chart showing nothing but practice still
          claimed a "versus players" line — which is precisely how a missing
          line reads as a broken chart rather than as a gap in the record. */}
      <figcaption className={styles.legend}>
        {placed.some((p) => p.ranked) && (
          <span className={styles.key} data-series="ranked">Versus players</span>
        )}
        {placed.some((p) => !p.ranked) && (
          <span className={styles.key} data-series="practice">Versus bots</span>
        )}
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
