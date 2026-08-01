/**
 * When to stop holding out for a person.
 *
 * Pulled out of the search screen as plain arithmetic because it is the kind of
 * rule that fails silently: an off-by-one here does not throw, it produces a
 * player sitting on a spinner until they close the tab. That is the single most
 * expensive outcome this screen has, and it is invisible from the outside.
 */

/**
 * The shortest anybody waits, and how much longer it might be.
 *
 * A range rather than a fixed number, because a wait that ends on exactly the
 * same second every search is the first thing anybody notices.
 *
 * The upper end came down from 49 seconds. Nearly fifty seconds of staring at a
 * spinner is a bounce for most people, and it was the common case rather than
 * the tail: with a flat spread over thirty seconds, most searches ended nearer
 * the top than the bottom. The floor stays at twenty, because the queue has to
 * get a real chance at a real opponent first — that is the whole reason the
 * server enforces its own minimum and will not honour an earlier request.
 */
export const MIN_WAIT_S = 20;
export const WAIT_SPREAD_S = 20;

/** Pick this search's limit. Called once per search. */
export function waitLimit(random: () => number = Math.random): number {
  return MIN_WAIT_S + Math.floor(random() * WAIT_SPREAD_S);
}

/**
 * How often to ask again, and for how long.
 *
 * **Asking once was a bug, and a total one.** The server enforces a floor on how
 * early a simulated opponent may be requested, timed from when it opened the
 * room; the client counts from when its own screen appeared. On a slow
 * connection those differ by enough that the request lands under the floor and
 * is refused — and since the client asked exactly once, that player then waited
 * for a human who was never coming, on a spinner that never resolved, forever.
 *
 * Repeating is safe rather than merely tolerable: the handler refuses anything
 * but a room still `waiting` with one player in it, so once an opponent is
 * seated every later request is a no-op. The old code said asking twice "would
 * open two rooms", which is not what that route does — it seats an opponent in
 * the room the caller is already in, and opens nothing.
 *
 * Bounded anyway. If simulated opponents are switched off entirely, every
 * request returns silence, and an unbounded retry would poll for as long as
 * somebody left the tab open.
 */
export const RETRY_EVERY_S = 5;
export const RETRY_FOR_S = 60;

/**
 * Which attempt is due at this second, or 0 for none.
 *
 * A number rather than a boolean so the caller can fire on each change: a
 * boolean that is already true cannot express "ask again", which is how the
 * original only ever asked once.
 */
export function askAttempt(seconds: number, limit: number): number {
  if (seconds < limit) return 0;
  if (seconds > limit + RETRY_FOR_S) return 0;
  const since = seconds - limit;
  if (since % RETRY_EVERY_S !== 0) return 0;
  return Math.floor(since / RETRY_EVERY_S) + 1;
}
