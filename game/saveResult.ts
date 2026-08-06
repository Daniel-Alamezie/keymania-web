'use client';

import { recordDuel } from './profile';
import type { FinishedDuel } from '@/models/profile';
import { invalidateProfile } from './serverProfile';

/**
 * Where a finished duel goes.
 *
 * Four cases, and the distinctions matter:
 *
 *  - A module boss is not a duel. It goes nowhere: not to the local record,
 *    not to the server. See below.
 *  - A human duel was refereed by the server, which already wrote both players'
 *    records from figures it computed itself. Posting again from here would
 *    double-count it, and would be the client's word for a ranked result.
 *  - Bot practice happens entirely in the browser, so there is no server-side
 *    truth. It is posted for the player's own history and stored unranked.
 *  - A signed-out guest gets the browser-local record only.
 *
 * Apart from a boss, the local record is written in every case: it is what the
 * menu panels read, so the arena updates the moment a duel ends without waiting
 * on a round trip.
 *
 * WHY A BOSS IS EXCLUDED. It is built out of a bot duel and was therefore
 * recorded as one, which a player reported after finding boss fights sitting in
 * their Recent duels and wondering whether the path was moving their rating.
 * It was not — practice is always `ranked: false` — but three things were
 * genuinely wrong:
 *
 *  - Recent duels showed a win over eight home-row keys next to real games.
 *  - Win rate and best wpm are figures about duelling, and a boss is timed
 *    against the curriculum's pace rather than a tier's, so its wpm is not
 *    comparable to anything else on that panel.
 *  - It was reported as `difficulty: 'rookie'` while the bot typed at the
 *    module's own speed, 17 wpm for home row against Rookie's 34. `beatBot` in
 *    the API's challenges counts practice wins by difficulty, so the gentlest
 *    boss on the path was earning credit for beating Rookie.
 *
 * The rule lives here rather than in the arena because this function is where
 * "where does a finished duel go" is already decided, and here it can be
 * tested. A boss's whole consequence is the star it grants on the path.
 */

export function saveResult({
  stats, won, wpm, accuracy, signedIn, multiplayer, difficulty, boss,
}: FinishedDuel): void {
  if (boss) return;

  recordDuel(stats, won, wpm, accuracy);

  // The account record now has a duel the cached copy does not know about —
  // whether the server wrote it or the POST below does. Without this the
  // dashboard would serve a stale record for up to a minute after a duel,
  // which is exactly when a player goes to look at it.
  if (signedIn) invalidateProfile();

  if (multiplayer || !signedIn) return;

  // Fire and forget: a practice result failing to sync is not worth
  // interrupting the victory screen for, and the next duel will sync anyway.
  void fetch('/api/me/duels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // `difficulty` is the whole reason this is worth recording: without it a
    // practice history is a pile of duels against "Bot", and no challenge can
    // ever ask you to beat a particular one.
    body: JSON.stringify({
      wpm, accuracy, won, maxCombo: stats.maxCombo, opponent: 'Bot', difficulty,
      // The duel's own clock, for the hours-played total. The server caps
      // what one game may add, so this is a report, not a claim.
      durationMs: stats.endedAt && stats.startedAt ? stats.endedAt - stats.startedAt : 0,
    }),
  }).catch(() => {});
}

export type { FinishedDuel } from '@/models/profile';
