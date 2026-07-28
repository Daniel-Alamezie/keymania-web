import { COUNTDOWN_FROM } from './constants';

/**
 * How long to wait before the next countdown tick.
 *
 * The client used to tick every 750ms, three times, and begin accepting
 * keystrokes 2250ms after a duel armed. The server stamps `startsAt` 3000ms
 * ahead and silently discards any word that arrives before it — no damage, no
 * error, nothing to see. So every human duel had a 750ms window at the start
 * where a fast typist's first words vanished, which looked like "damage
 * sometimes does not count" and was worst on a rematch, where nothing else is
 * slow enough to hide the gap.
 *
 * The fix is to stop guessing. The server sends `countdownMs` with the match
 * and always has; this spreads whatever it says across the ticks that remain,
 * recomputing each time so the final tick lands on the server's deadline
 * rather than on an assumption about it.
 *
 * A duration is used rather than an absolute timestamp deliberately: the two
 * clocks are unrelated, and only elapsed time means the same thing on both. It
 * is measured from when the message arrived, so transit time makes the client
 * marginally *later* than the server — the safe direction, because a word that
 * is early is thrown away while one that is late is merely late.
 */
export function tickDelay(msToStart: number, ticksLeft: number): number {
  if (ticksLeft <= 0) return 0;
  return Math.max(0, Math.round(msToStart / ticksLeft));
}

/** Local practice has no referee to agree with, so it keeps its own pace. */
export const SOLO_TICK_MS = 750;

/** What the client assumes when a server predates `countdownMs`. */
export const FALLBACK_COUNTDOWN_MS = COUNTDOWN_FROM * SOLO_TICK_MS;
