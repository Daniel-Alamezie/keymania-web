/**
 * The geometry behind the profile sparkline.
 *
 * Separated from the component because the arithmetic is the part that can be
 * wrong and the JSX is not, and because this repo tests pure functions — there
 * is no DOM harness here, and adding jsdom to check that a polyline has the
 * right points would be a dependency bought to test nine lines of division.
 *
 * Every case that has actually broken a chart like this is a degenerate input
 * rather than a normal one: a series of one, a series that never changes, a
 * series of zeroes. Those are cheap to assert against a returned string and
 * near-impossible to notice by looking at a rendered card, because the failure
 * mode is a chart that quietly does not appear.
 */

/**
 * The drawing box. Not the rendered size — the SVG stretches to its container —
 * only the coordinate space this arithmetic works in.
 */
export const W = 300;
export const H = 64;

/**
 * Room around the line, in the same coordinate space.
 *
 * Vertically it stops a personal best being drawn along the top edge with half
 * its stroke clipped, which makes somebody's best run look like a rendering
 * fault. Horizontally it keeps the end marker inside the box.
 */
export const PAD = 5;

export interface SparkGeometry {
  /** `points` for a polyline: the trend itself. */
  line: string;
  /** A closed path under the line, for the wash beneath it. */
  area: string;
  /** Where to put the "you are here" mark, at the newest value. */
  marker: { x: number; y: number };
}

/**
 * Turn a series into paths, or `null` when there is no trend to draw.
 *
 * Fewer than two points returns null rather than a degenerate path. A line
 * needs two ends, and manufacturing a second point to satisfy the maths would
 * draw a flat trend that a player's single duel does not support — the caller
 * shows the caption and omits the chart.
 */
export function sparkGeometry(points: number[]): SparkGeometry | null {
  if (points.length < 2) return null;

  const low = Math.min(...points);
  const high = Math.max(...points);

  /**
   * The divide-by-zero case, and the reason this function exists to be tested.
   *
   * Every value identical gives `high === low`, so `(value - low) / 0` is NaN
   * for every point. An SVG path of "NaN,NaN" renders as nothing at all — the
   * chart silently vanishes for the steadiest typists on the board, which is
   * both the hardest failure to notice and the least deserved. A span of 1 puts
   * a flat series on a flat line, which is the honest picture of it.
   */
  const span = high - low || 1;

  const left = PAD;
  const right = W - PAD;
  const x = (index: number) => left + (index / (points.length - 1)) * (right - left);
  const y = (value: number) => H - PAD - ((value - low) / span) * (H - PAD * 2);

  const coords = points.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`);

  return {
    line: coords.join(' '),
    // Closed back along the floor. A separate path rather than filling the
    // polyline itself, which would shade the area *above* a descending run and
    // read as a completely different chart.
    area: `M${coords[0]} L${coords.slice(1).join(' L')} L${right},${H} L${left},${H} Z`,
    marker: { x: right, y: y(points.at(-1)!) },
  };
}
