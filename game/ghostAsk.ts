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
 * Down again, from 20-39 seconds, and this time the queue's own numbers made
 * the case. Across two days of production it paired **one** search with a real
 * person against four hundred and thirty that ended in a simulated opponent —
 * so holding every player for the better part of a minute was preserving a
 * possibility that fires roughly once in four hundred, and charging everybody
 * a spinner for it.
 *
 * The floor stays above the server's own minimum of fifteen seconds on
 * purpose. That minimum is what stops a modified client skipping the queue
 * entirely, and a client whose patience ran out *below* it would have every
 * first request refused and would wait for the retry instead — slower than
 * simply asking later. Ten seconds of margin covers a slow socket without
 * getting anywhere near it.
 *
 * This is a number to revisit, not a settled one: the day real players are
 * dense enough that pairings actually happen, waiting longer starts being
 * worth something again.
 */
export const MIN_WAIT_S = 16;
export const WAIT_SPREAD_S = 9;

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
