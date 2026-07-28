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

/**
 * The flame that burns beside a rating.
 *
 * Bands rather than a crown. A crown means champion, and one beside every
 * rating — including the 300 handed to somebody who has never duelled a person
 * — says nothing, while quietly devaluing it for whoever eventually earns one.
 *
 * Three colours the leaderboard already uses for the podium, so the two screens
 * agree about what a flame means: standing. It also changes as you climb, which
 * is the part a static mark cannot do — the mark is itself the progress.
 */
export const AZURE_FROM = 350;
export const GOLD_FROM = 450;

export const ratingFlame = (rating: number): 'ember' | 'azure' | 'gold' => {
  if (rating >= GOLD_FROM) return 'gold';
  if (rating >= AZURE_FROM) return 'azure';
  return 'ember';
};
