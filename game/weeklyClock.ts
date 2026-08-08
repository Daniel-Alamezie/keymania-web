/**
 * The weekly challenge's clock, client side.
 *
 * Mirrors lib/weekly.ts on the API: the sprint window is thirty seconds and
 * the week turns over every Monday at noon LONDON — the promise made in
 * public is "12pm UK time", and the UK moves against UTC twice a year, so
 * the timezone lives in the arithmetic rather than in a constant offset.
 *
 * Display only. The server referees the sprint against its own clock and
 * decides which week a run belongs to; everything here exists to label a
 * board tab and count down to the next script.
 */

export const WEEKLY_MS = 30_000;

/** London wall-clock parts for a moment, from the browser's own ICU data. */
function londonParts(at: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(new Date(at));
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: read('year'), month: read('month'), day: read('day'),
    hour: read('hour') % 24, minute: read('minute'), second: read('second'),
  };
}

/** Monday-based day of week for a London calendar date. */
function londonWeekday(at: number): number {
  const { year, month, day } = londonParts(at);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/**
 * The epoch of a given London wall-clock moment, by correction.
 *
 * Guess the moment as if London were UTC, ask what London actually says at
 * that guess, and shift by the difference. One correction lands except
 * within a DST transition itself — and noon is hours clear of both UK
 * transitions, which happen at 1am, so a second pass is a safeguard rather
 * than a code path anything is expected to take.
 */
function londonMomentEpoch(year: number, month: number, day: number, hour: number): number {
  let guess = Date.UTC(year, month - 1, day, hour);
  for (let i = 0; i < 2; i += 1) {
    const seen = londonParts(guess);
    const want = Date.UTC(year, month - 1, day, hour);
    const got = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    if (got === want) return guess;
    guess += want - got;
  }
  return guess;
}

/** ISO week of a calendar date, from the standard Thursday rule. */
function isoWeekOf(year: number, month: number, day: number): { year: number; week: number } {
  const date = Date.UTC(year, month - 1, day);
  const dayOfWeek = (new Date(date).getUTCDay() + 6) % 7;
  const thursday = new Date(date + (3 - dayOfWeek) * 86_400_000);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = Date.UTC(isoYear, 0, 4);
  const jan4Day = (new Date(jan4).getUTCDay() + 6) % 7;
  const firstThursday = jan4 + (3 - jan4Day) * 86_400_000;
  const week = 1 + Math.round((thursday.getTime() - firstThursday) / (7 * 86_400_000));
  return { year: isoYear, week };
}

/**
 * Which challenge week a moment falls in, e.g. "2026-W32".
 *
 * The same subtraction lib/weekly.ts does on the server: step the London
 * wall-clock back twelve hours and the noon boundary becomes midnight, after
 * which it is plain ISO week arithmetic. Here it seasons the practice
 * generator, so the warm-up and the typing test change texture on the same
 * Monday the weekly script does. Nothing scored hangs off the client's copy:
 * if a clock-skewed browser disagrees with the server for an hour, the cost
 * is flavour, not fairness.
 */
export function weekId(at = Date.now()): string {
  const clock = londonParts(at);
  const shifted = new Date(Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour - 12));
  const iso = isoWeekOf(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  return `${iso.year}-W${String(iso.week).padStart(2, '0')}`;
}

/** The epoch of the next Monday-noon-London boundary strictly after `at`. */
export function nextRollover(at = Date.now()): number {
  // Walk to the coming Monday on the London calendar. Today counts if its
  // noon has not passed yet.
  for (let days = 0; days <= 7; days += 1) {
    const probe = at + days * 86_400_000;
    if (londonWeekday(probe) !== 0) continue;
    const { year, month, day } = londonParts(probe);
    const noon = londonMomentEpoch(year, month, day, 12);
    if (noon > at) return noon;
  }
  // Unreachable: any eight consecutive days contain a Monday with a future
  // noon. Kept as arithmetic rather than a throw so a caller renders "soon"
  // instead of a broken board on the day this proves wrong.
  return at + 7 * 86_400_000;
}

/**
 * A countdown a board tab can wear: "2d 4h", then "4h 12m", then "12m".
 *
 * Two units at most, coarsest first. Seconds never appear — a leaderboard
 * caption that ticks every second is a distraction dressed as information.
 */
export function untilRollover(at = Date.now()): string {
  const left = Math.max(0, nextRollover(at) - at);
  const minutes = Math.floor(left / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${Math.max(1, minutes)}m`;
}
