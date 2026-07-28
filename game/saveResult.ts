'use client';

import { recordDuel } from './profile';
import type { FinishedDuel } from '@/models/profile';
import { invalidateProfile } from './serverProfile';

/**
 * Where a finished duel goes.
 *
 * Three cases, and the distinction matters:
 *
 *  - A human duel was refereed by the server, which already wrote both players'
 *    records from figures it computed itself. Posting again from here would
 *    double-count it, and would be the client's word for a ranked result.
 *  - Bot practice happens entirely in the browser, so there is no server-side
 *    truth. It is posted for the player's own history and stored unranked.
 *  - A signed-out guest gets the browser-local record only.
 *
 * The local record is written in every case: it is what the menu panels read,
 * so the arena updates the moment a duel ends without waiting on a round trip.
 */

export function saveResult({
  stats, won, wpm, accuracy, signedIn, multiplayer, difficulty,
}: FinishedDuel): void {
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
    }),
  }).catch(() => {});
}

export type { FinishedDuel } from '@/models/profile';
