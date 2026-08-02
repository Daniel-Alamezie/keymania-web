/**
 * Rating, as the client needs to know it.
 *
 * The rules live on the server (`src/lib/rating.ts` in keymania-api) and stay
 * there: a rating the browser could compute is a rating the browser could
 * argue about, and the whole point of the number is that one referee decides
 * it. What is mirrored here are the figures the game has to *say out loud* —
 * so a profile can be drawn before the first human duel, and so the board's
 * own explainer can quote the system rather than describe it vaguely.
 *
 * Nothing here is used to compute a rating, only to describe one. Every value
 * is pinned literally by `game/tests/rating.test.ts` against the server's own
 * test, because a drifted copy here would not break anything — it would just
 * quietly tell players the wrong rules, which is worse.
 */

/** Where everybody starts, matching START_RATING on the server. */
export const START_RATING = 300;

/** The lowest a rating can fall, however badly it goes. */
export const RATING_FLOOR = 100;

/** What winning is worth, before any upset bonus. */
export const WIN_POINTS = 10;

/** What finishing last costs. Deliberately less than a win pays. */
export const LOSS_POINTS = -8;

/** The most beating a higher-rated player can add on top of the win. */
export const MAX_UPSET_BONUS = 3;

/**
 * The most a routine win is trimmed by. Mirrors the API's rule: beating
 * somebody rated far below you pays less, one point per 25 of gap, and a win
 * never pays less than WIN_POINTS minus this.
 */
export const MAX_ROUTINE_DISCOUNT = 5;

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
