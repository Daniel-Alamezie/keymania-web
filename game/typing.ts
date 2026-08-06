/**
 * Whether a keystroke counts, when the script itself decides about case.
 *
 * **This existed twice and only one copy had it right, which is how module 8's
 * boss became unbeatable.** The lesson runner learned the rule when capitals
 * shipped; the duel kept the sprint's blanket `toLowerCase()`, and the boss
 * fight is a duel. So a capitals boss asking for "Friday" could never be
 * satisfied — the F the player typed with shift arrived as "F", was folded to
 * "f", and was marked a miss. Every capital in that fight was unhittable,
 * which walled the whole path at module 8, because the third star is what
 * opens module 9.
 *
 * The rule, in one place now:
 *
 *  - **A lower-case expectation accepts either case.** Case is not what that
 *    exercise is about, and somebody who left caps lock on during the home row
 *    is making a mistake the screen has no business punishing.
 *  - **An upper-case expectation is exact.** There it is the entire point:
 *    shift, held with the opposite hand, is what module 8 teaches, and
 *    accepting the lower-case letter would mark the lesson passed without the
 *    thing it teaches ever having happened.
 *
 * Deliberately not used by the warm-up, which folds case unconditionally. That
 * screen's whole claim is that nothing there is being judged, and somebody
 * warming up with caps lock on is warming up rather than failing.
 */

/**
 * The character a keystroke should be judged as, given what is expected.
 *
 * `expected` may be undefined at the end of a script, where nothing can match
 * and the caller is about to bail out anyway; folding is the harmless answer.
 */
export function keyFor(expected: string | undefined, raw: string): string {
  const teachesCase = expected !== undefined && expected !== expected.toLowerCase();
  return teachesCase ? raw : raw.toLowerCase();
}
