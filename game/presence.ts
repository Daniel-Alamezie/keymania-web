'use client';

import { useEffect, useRef } from 'react';

/**
 * Telling the server we are here.
 *
 * A heartbeat rather than a socket, and not for want of a socket: the game
 * only opens one when a player *starts* something, so somebody sitting on the
 * menu has no connection at all. Opening idle sockets would fix that and
 * still not be enough on its own, because `$disconnect` is best-effort — a
 * crashed tab leaves a connection looking alive for hours. Presence needs a
 * positive signal whatever the transport, so the socket version is strictly
 * more work for the same guarantee. See lib/presence.ts on the API.
 */

/** Matches BEAT_MS on the server, which sets its freshness window from it. */
const BEAT_MS = 15_000;

/**
 * Check in, for as long as this component is mounted.
 *
 * `busy` says whether the player is mid-game. Reported rather than inferred:
 * the client knows for certain, and the server's alternatives are a stale
 * field that would show everybody permanently duelling or a room fetch per
 * friend per poll. Nothing is won by lying — claiming to be busy is a
 * do-not-disturb, and claiming to be idle only invites an interruption onto
 * yourself.
 */
export function useHeartbeat(signedIn: boolean, busy: boolean): void {
  /**
   * The current `busy` in a ref, so changing modes does not restart the
   * timer. Without it, every transition between menu and duel would clear
   * and re-arm the interval, and a player bouncing in and out of games would
   * beat far more often than asked.
   */
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    if (!signedIn) return;

    const beat = () => {
      // Fire and forget. A missed heartbeat costs a friend seeing a stale
      // dot for a few seconds, which is not worth a retry, a spinner, or a
      // single line of error handling anywhere near the game.
      void fetch('/api/me/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ busy: busyRef.current }),
        keepalive: true,
      }).catch(() => {});
    };

    // Once immediately, so arriving on the menu shows up to friends now
    // rather than in fifteen seconds.
    beat();
    const id = setInterval(beat, BEAT_MS);
    return () => clearInterval(id);
  }, [signedIn]);
}
