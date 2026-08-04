import { describe, expect, it } from 'vitest';
import { H, PAD, W, sparkGeometry } from '../sparkline';

/**
 * The sparkline's arithmetic.
 *
 * Almost all of this is degenerate input, on purpose. A trend chart drawn from
 * three rising numbers works on the first attempt; what breaks it is a player
 * whose last twenty duels were all 80wpm, or who has played exactly once, or
 * who has a single zero in the series. Each of those fails *silently* — the
 * path becomes unparseable and the browser draws nothing, so the card looks
 * merely empty rather than broken.
 */

const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe('sparkGeometry', () => {
  it('draws nothing for an empty series', () => {
    expect(sparkGeometry([])).toBeNull();
  });

  it('draws nothing for a single duel', () => {
    // One point is not a trend, and inventing a second to make a line would
    // assert a flatness the player's one duel does not support.
    expect(sparkGeometry([80])).toBeNull();
  });

  it('spans the full width, inset at both ends', () => {
    const g = sparkGeometry([10, 20, 30])!;
    const xs = g.line.split(' ').map((pair) => Number(pair.split(',')[0]));

    expect(xs[0]).toBe(PAD);
    expect(xs.at(-1)).toBe(W - PAD);
    // Evenly spaced: the x-axis is sequence, not time.
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 1);
  });

  it('puts the best value at the top and the worst at the bottom', () => {
    const g = sparkGeometry([50, 100, 75])!;
    const ys = g.line.split(' ').map((pair) => Number(pair.split(',')[1]));

    // SVG y grows downwards, so the highest value has the smallest y.
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[2]).toBeLessThan(ys[0]);
    expect(Math.min(...ys)).toBe(PAD);
    expect(Math.max(...ys)).toBe(H - PAD);
  });

  it('never draws outside the box', () => {
    // The padding is the whole reason a personal best is not half-clipped along
    // the top edge, where it reads as a rendering fault rather than a record.
    const g = sparkGeometry([12, 200, 3, 88, 45])!;
    const ys = g.line.split(' ').map((pair) => Number(pair.split(',')[1]));

    expect(Math.min(...ys)).toBeGreaterThanOrEqual(PAD);
    expect(Math.max(...ys)).toBeLessThanOrEqual(H - PAD);
  });

  describe('a series that never changes', () => {
    /**
     * The divide-by-zero. `high === low` makes every point NaN, and an SVG path
     * containing "NaN" renders as nothing — so the chart disappears for exactly
     * the players whose consistency is worth showing, and nothing anywhere
     * reports an error.
     */
    it('produces no NaN anywhere', () => {
      const g = sparkGeometry([80, 80, 80, 80])!;

      expect(g.line).not.toMatch(/NaN/);
      expect(g.area).not.toMatch(/NaN/);
      expect(numbers(g.line).every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(g.marker.y)).toBe(true);
    });

    it('draws it flat', () => {
      const g = sparkGeometry([80, 80, 80])!;
      const ys = g.line.split(' ').map((pair) => Number(pair.split(',')[1]));

      expect(new Set(ys).size).toBe(1);
    });

    it('handles a series of all zeroes', () => {
      // Not reachable through recentWpm, which filters zeroes out — but this is
      // a general geometry helper and `0 - 0 || 1` is the same trap.
      const g = sparkGeometry([0, 0])!;
      expect(g.line).not.toMatch(/NaN/);
    });
  });

  describe('the area path', () => {
    it('starts at the line and closes along the floor', () => {
      const g = sparkGeometry([10, 90])!;

      expect(g.area.startsWith(`M${PAD}`)).toBe(true);
      // Down to the baseline at the right, back along it to the left, closed.
      expect(g.area.endsWith(`L${W - PAD},${H} L${PAD},${H} Z`)).toBe(true);
    });

    it('follows every point of the line', () => {
      const g = sparkGeometry([10, 50, 30, 90])!;
      // Four line points plus the two floor corners.
      expect(g.area.match(/[ML]/g)).toHaveLength(6);
    });
  });

  describe('the end marker', () => {
    it('sits on the newest value, at the right-hand end', () => {
      const g = sparkGeometry([10, 20, 90])!;
      const lastPoint = g.line.split(' ').at(-1)!.split(',').map(Number);

      expect(g.marker.x).toBe(W - PAD);
      expect(g.marker.y).toBeCloseTo(lastPoint[1], 1);
    });

    it('follows a decline rather than pinning to the top', () => {
      // The mark says "where you are now", not "where your best was".
      const rising = sparkGeometry([10, 90])!;
      const falling = sparkGeometry([90, 10])!;

      expect(rising.marker.y).toBeLessThan(falling.marker.y);
    });
  });

  it('does not mutate its input', () => {
    const points = [30, 10, 20];
    sparkGeometry(points);
    expect(points).toEqual([30, 10, 20]);
  });
});
