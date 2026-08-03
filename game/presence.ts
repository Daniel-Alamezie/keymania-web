'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AcceptedInvite, PendingInvite, PresenceResponse } from '@/models/invites';

/**
 * Telling the server we are here, and hearing who wants a game.
 *
 * A heartbeat rather than a socket, and not for want of a socket: the game
 * only opens one when a player *starts* something, so somebody sitting on the
 * menu has no connection at all. Opening idle sockets would fix that and
 * still not be enough on its own, because `$disconnect` is best-effort — a
 * crashed tab leaves a connection looking alive for hours. Presence needs a
 * positive signal whatever the transport, so the socket version is strictly
 * more work for the same guarantee. See lib/presence.ts on the API.
 *
 * The same call carries invites back, for a reason that falls out of the
 * above: the only player who can be invited is one on the menu, and a player
 * on the menu is exactly the player with no socket to push down. The request
 * was already happening, so the invite rides on its answer.
 */

/** Matches BEAT_MS on the server, which sets its freshness window from it. */
const BEAT_MS = 15_000;

/**
 * How often to check in while an invite of this player's is outstanding.
 *
 * The one moment the ordinary rate is too slow. An inviter who is free to go
 * and browse only finds out their friend said yes on the next beat, and
 * fifteen seconds of nothing happening after somebody accepts reads as a
 * failure. This is a ninety-second window at most, for one player, and it
 * costs a handful of extra beats to make the handover feel immediate.
 */
const EAGER_MS = 5_000;

/**
 * Check in, for as long as this component is mounted.
 *
 * `busy` says whether the player is mid-game. Reported rather than inferred:
 * the client knows for certain, and the server's alternatives are a stale
 * field that would show everybody permanently duelling or a room fetch per
 * friend per poll. Nothing is won by lying — claiming to be busy is a
 * do-not-disturb, and claiming to be idle only invites an interruption onto
 * yourself.
 *
 * Returns whatever invites are waiting, and a way to forget one locally. The
 * hook holds no opinion about what an invite means; the menu decides that.
 */
export function useHeartbeat(signedIn: boolean, busy: boolean, waiting = false): {
  invites: PendingInvite[];
  accepted: AcceptedInvite[];
  dismiss: (fromHandle: string) => void;
  forget: (fromHandle: string) => void;
} {
  /**
   * The current `busy` in a ref, so changing modes does not restart the
   * timer. Without it, every transition between menu and duel would clear
   * and re-arm the interval, and a player bouncing in and out of games would
   * beat far more often than asked.
   */
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [accepted, setAccepted] = useState<AcceptedInvite[]>([]);

  /**
   * Rooms this browser has already walked into.
   *
   * The answer row lives for a few minutes so a dropped response cannot lose
   * the room, which means the same room can arrive on more than one beat. This
   * is what stops the second delivery trying to seat a player who is already
   * seated — a join the server would refuse as `same-account`, which is
   * correct and would read as a broken invite.
   */
  const joined = useRef<Set<string>>(new Set());

  const forget = useCallback((fromHandle: string) => {
    setAccepted((was) => was.filter((a) => a.fromHandle !== fromHandle));
    void fetch(`/api/invites/${encodeURIComponent(fromHandle)}/answer`, {
      method: 'DELETE',
    }).catch(() => {});
  }, []);

  /**
   * Invites this browser has already answered or waved away.
   *
   * A ref, and it has to be one: the next heartbeat is in flight before the
   * server has finished forgetting a declined invite, and without this the
   * reply would put it straight back on screen. The server is still the
   * authority — this only stops a card flickering back during the second or
   * two that takes.
   */
  const dismissed = useRef<Set<string>>(new Set());

  const dismiss = useCallback((fromHandle: string) => {
    dismissed.current.add(fromHandle);
    setInvites((was) => was.filter((invite) => invite.fromHandle !== fromHandle));
  }, []);

  useEffect(() => {
    if (!signedIn) return;

    let live = true;

    const beat = async () => {
      try {
        const res = await fetch('/api/me/presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ busy: busyRef.current }),
          keepalive: true,
        });
        if (!live || !res.ok) return;

        const data = (await res.json()) as PresenceResponse;
        if (!live) return;

        const asks = data.invites ?? [];
        /**
         * Anything the server has stopped sending is genuinely gone, so the
         * local memory of it can go too. Without this pruning, a friend who
         * was declined once could never invite again from this tab.
         */
        dismissed.current = new Set(
          [...dismissed.current].filter((h) => asks.some((i) => i.fromHandle === h)),
        );
        setInvites(asks.filter((invite) => !dismissed.current.has(invite.fromHandle)));

        // Anything already walked into is dropped here rather than by the
        // caller, so no consumer has to remember that answers can repeat.
        const answers = (data.accepted ?? []).filter((a) => !joined.current.has(a.roomId));
        answers.forEach((a) => joined.current.add(a.roomId));
        if (answers.length) setAccepted((was) => [...was, ...answers]);
      } catch {
        /*
         * Silent, deliberately. A missed heartbeat costs a friend seeing a
         * stale dot for a few seconds and an invite arriving fifteen seconds
         * later than it might have. Neither is worth a retry, a spinner, or a
         * single line of error handling anywhere near the game.
         */
      }
    };

    // Once immediately, so arriving on the menu shows up to friends now
    // rather than in fifteen seconds.
    const rate = waiting ? EAGER_MS : BEAT_MS;
    void beat();
    let id = setInterval(() => { void beat(); }, rate);

    /**
     * A hidden tab is not a player who is around.
     *
     * Two things wrong with beating through it, and the smaller one is the
     * money: a tab left open overnight would check in nineteen hundred times
     * to tell nobody anything, and each of those is a write against a player
     * row that grows with their history.
     *
     * The larger one is that it would be a lie. Somebody with KeyMania buried
     * behind a dozen tabs is not available for a duel, and showing them green
     * sends their friends into a ninety-second wait for an answer that is
     * never coming. Going quiet lets presence lapse on its own, which is the
     * honest reading, and coming back beats immediately so returning to the
     * tab puts them online at once rather than up to fifteen seconds later.
     */
    const onVisibility = () => {
      clearInterval(id);
      if (document.visibilityState === 'visible') {
        void beat();
        id = setInterval(() => { void beat(); }, rate);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [signedIn, waiting]);

  /**
   * Signing out empties the list by derivation rather than by clearing state.
   *
   * The effect stops beating, so nothing would overwrite a stale list, and
   * wiping it from inside the effect is both a cascading render and a second
   * source of truth for the same fact. Derived, there is only one.
   */
  return {
    invites: signedIn ? invites : [],
    accepted: signedIn ? accepted : [],
    dismiss,
    forget,
  };
}
