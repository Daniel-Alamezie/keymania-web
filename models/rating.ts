/**
 * Rating, as the client needs to know it.
 *
 * The rules live on the server (`src/lib/rating.ts` in keymania-api) and stay
 * there: a rating the browser could compute is a rating the browser could
 * argue about, and the whole point of the number is that one referee decides
 * it. All that is mirrored here is where everybody starts, so a profile can be
 * drawn before the first human duel has ever been played.
 */

/** Where everybody starts, matching START_RATING on the server. */
export const START_RATING = 300;
