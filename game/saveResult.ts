'use client';

import type { DuelStats } from './duelReducer';
import { recordDuel } from './profile';

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
export interface FinishedDuel {
  stats: DuelStats;
  won: boolean;
  wpm: number;
  accuracy: number;
  signedIn: boolean;
  /** Absent for bot practice. */
  multiplayer: boolean;
}

export function saveResult({ stats, won, wpm, accuracy, signedIn, multiplayer }: FinishedDuel): void {
  recordDuel(stats, won, wpm, accuracy);

  if (multiplayer || !signedIn) return;

  // Fire and forget: a practice result failing to sync is not worth
  // interrupting the victory screen for, and the next duel will sync anyway.
  void fetch('/api/me/duels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wpm, accuracy, won, maxCombo: stats.maxCombo, opponent: 'Bot' }),
  }).catch(() => {});
}
