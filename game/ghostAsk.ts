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
 * Down twice already, from 50 to 20-39 to 16-24, and now to 5-8. Every cut has
 * been made by the same number: across two days of production the queue paired
 * **one** search with a real person against four hundred and thirty that ended
 * in a simulated opponent. Holding anybody at all is charging every player a
 * spinner for a possibility that fires about once in four hundred.
 *
 * The last cut was prompted by somebody on r/typing saying the wait was the
 * reason they would not use the game. That is the cheapest possible version of
 * a piece of feedback nobody else bothered to send.
 *
 * **The floor still has to clear the server's own minimum**, which came down to
 * four seconds in the same change. That is not a coincidence to be tidied up
 * later: the server refuses anything earlier, and the client retries only every
 * five seconds, so a client asking under the floor is refused and seated on a
 * retry instead — which was the whole cost of leaving the two out of step. The
 * web test mirrors the server's number and fails if they cross.
 *
 * This is a number to revisit, not a settled one: the day real players are
 * dense enough that pairings actually happen, waiting longer starts being
 * worth something again.
 */
export const MIN_WAIT_S = 5;
export const WAIT_SPREAD_S = 4;

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
