/**
 * The streak calendar, turned into something a grid can draw.
 *
 * The server sends the smallest thing it can: a run of digits, one per day, and
 * the day the first digit describes. Everything else — which column a day falls
 * in, which row, where the months change, which cells are the future and must
 * stay blank — is arithmetic, and it is the kind that is wrong by exactly one
 * and looks completely plausible. So it lives here, pure, rather than inside a
 * component where it can only be checked by squinting at squares.
 */

/** What `GET /api/me/profile` sends back. */
export interface Streak {
  /** Days running as of today. Resolved by the server against its own clock. */
  current: number;
  /** The longest run ever reached. */
  best: number;
  /** The server's idea of today, as a whole number of days since the epoch. */
  today: number;
  /** The day `calendar[0]` describes. Absent when nothing has been recorded. */
  origin?: number;
  /** One character per day, '0' (nothing) to '4' (a long session). */
  calendar?: string;
}

/** Rows, Monday at the top. */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** How many weeks the grid draws. Fifty-three, so a full year always fits. */
export const WEEKS = 53;

/**
 * Which row a day belongs in, Monday first.
 *
 * Epoch day 0 was a Thursday, so the `+ 3` is what puts Monday at zero rather
 * than a magic constant. The second modulo is for negative days: JavaScript's
 * `%` keeps the sign of the left operand, so `-1 % 7` is `-1` rather than `6`,
 * which would put a pre-1970 day in row minus one. Unreachable in practice and
 * cheaper to handle than to prove impossible.
 */
export const weekday = (day: number): number => (((day + 3) % 7) + 7) % 7;

/** A day's date, for labels and tooltips. */
export const dateOf = (day: number): Date => new Date(day * 86_400_000);

export interface Cell {
  /** Absent for the padding after today: the future is not a blank day. */
  day?: number;
  /** 0 to 4. Zero for a day nobody played and for anything before the record. */
  level: number;
}

/** A column is one week, Monday at index 0. */
export type Column = Cell[];

/**
 * What the digits mean, in words.
 *
 * Bands rather than exact counts, because bands are all that is stored: one
 * character per day buys a year of history for a few hundred bytes, and the
 * price is that the tooltip cannot say "47 words". Saying the range is honest;
 * inventing a number would not be.
 */
export const LEVEL_LABEL = [
  'nothing typed',
  'under 30 words',
  '30 to 79 words',
  '80 to 159 words',
  '160 or more words',
] as const;

/**
 * Lay the calendar out in columns of seven.
 *
 * The last column is the week containing today, so the grid always ends on the
 * cell somebody is looking for. Days after today in that column carry no `day`
 * at all: an unplayed Wednesday and a Wednesday that has not happened yet are
 * different things, and drawing them the same way is how a grid tells somebody
 * they missed a day they could not possibly have played.
 */
export function columns(streak: Streak | undefined, weeks = WEEKS): Column[] {
  if (!streak) return [];

  const { today, origin, calendar } = streak;

  // Back to the Monday of this week, then back again by however many whole
  // weeks are being drawn. Anchoring on the Monday rather than on `today - 370`
  // is what keeps every column a real week instead of a rolling seven days.
  const lastMonday = today - weekday(today);
  const firstMonday = lastMonday - (weeks - 1) * 7;

  const levelAt = (day: number): number => {
    if (origin === undefined || !calendar) return 0;
    const index = day - origin;
    // The upper bound overlaps the clamp below rather than guarding something
    // it cannot: `calendar[past the end]` is undefined, which coerces to NaN
    // and falls out as 0 anyway. Kept because "outside the recorded span" is
    // the actual intent, and relying on a NaN coercion to express it is the
    // sort of cleverness that gets refactored away by someone who cannot see
    // why it mattered.
    if (index < 0 || index >= calendar.length) return 0;
    const level = Number(calendar[index]);
    // A record written by a newer server, or a corrupted one. Clamped rather
    // than trusted: an out-of-range level would index past the end of the
    // colour ramp and render as an untinted hole in the grid.
    return Number.isFinite(level) ? Math.max(0, Math.min(4, level)) : 0;
  };

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, row): Cell => {
      const day = firstMonday + week * 7 + row;
      return day > today ? { level: 0 } : { day, level: levelAt(day) };
    }));
}

/**
 * How close to the right edge a label may start.
 *
 * A month name is three characters that will not wrap, and a grid column is a
 * dozen or so pixels — so a label placed in the last column runs past the end
 * of the grid. That overflow is invisible in itself and does something very
 * visible: it makes the whole calendar wider than its container, which puts a
 * horizontal scrollbar under a grid that otherwise fits perfectly.
 *
 * Three columns of clearance is enough for the longest abbreviation at the
 * sizes this renders at.
 */
const EDGE_CLEARANCE = 3;

/**
 * Where the month names go.
 *
 * A label is placed on the first column whose Monday falls in a new month,
 * which is how the eye reads a year: the boundary matters, the exact date does
 * not. The very first column is skipped when it is a stub — a label hard
 * against the left edge next to another one a few pixels later reads as two
 * months at the same place — and so are the last few, for the reason above.
 *
 * Losing the final label costs almost nothing: the rightmost weeks are the ones
 * a reader is already oriented in, because they are today.
 */
export function monthLabels(cols: Column[]): Array<{ week: number; label: string }> {
  const labels: Array<{ week: number; label: string }> = [];
  let previous = -1;

  cols.forEach((column, week) => {
    const first = column.find((cell) => cell.day !== undefined);
    if (!first?.day) return;
    const month = dateOf(first.day).getUTCMonth();
    if (month === previous) return;
    previous = month;
    if (week === 0) return;
    if (week > cols.length - 1 - EDGE_CLEARANCE) return;
    labels.push({
      week,
      label: dateOf(first.day).toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }),
    });
  });

  return labels;
}

/**
 * A cell's tooltip.
 *
 * The date is read back in UTC because the day number is already local: it was
 * derived from the player's own offset on the server, so re-applying the
 * browser's offset here would shift every square by one for anybody west of
 * Greenwich, which is the same bug this whole feature exists to avoid.
 */
export function cellTip(cell: Cell): string | undefined {
  if (cell.day === undefined) return undefined;
  const when = dateOf(cell.day).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  return `${LEVEL_LABEL[cell.level]} on ${when}`;
}
