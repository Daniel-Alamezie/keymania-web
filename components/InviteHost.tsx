'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/game/useAccount';
import { useHeartbeat } from '@/game/presence';
import { useBusy } from '@/game/busy';
import { clearWaiting, useWaiting } from '@/game/waiting';
import { offerRoom } from '@/game/joinIntent';
import type { AcceptResponse, InviteError, PendingInvite } from '@/models/invites';
import InviteToast from './InviteToast';
import WaitingPill from './WaitingPill';
import styles from './InviteToast.module.css';

/**
 * Both halves of an invite, above every page.
 *
 * The toast is somebody asking; the pill is this player's own ask, still out.
 * Neither can live inside a page, and for the same reason: an invite arrives
 * and is answered on nobody's schedule but the other person's, so anything
 * that renders it has to outlive whatever screen the player happens to be on.
 *
 * That is also why the heartbeat is mounted here. It used to run inside the
 * arena and the profile dashboard, which meant a player reading the
 * leaderboard looked offline to every friend they had.
 */
export default function InviteHost() {
  const account = useAccount();
  const busy = useBusy();
  const waiting = useWaiting();
  const router = useRouter();

  /**
   * Busy comes from the arena rather than from the route.
   *
   * Guessing from the pathname would be wrong in both directions: `/` is the
   * menu as often as it is a duel, and a player who navigated away mid-match
   * has left the game rather than paused it. Only the arena knows.
   *
   * The third argument asks for a faster beat while this player's own invite
   * is outstanding, so the handover when a friend accepts feels immediate
   * rather than arriving up to fifteen seconds later.
   */
  const { invites, accepted, dismiss, forget } = useHeartbeat(
    account.signedIn,
    busy,
    Boolean(waiting),
  );

  /**
   * Somebody said yes: go and play them.
   *
   * The room already exists — the server made it when they accepted — so this
   * is only a matter of getting there. The arena takes the code directly if it
   * is on screen, and otherwise it is parked and collected as the arena mounts.
   *
   * `forget` is what stops the answer arriving again. Its row outlives this
   * moment by a few minutes so a dropped response cannot lose the room, which
   * means without this the same room would be offered on every beat until the
   * TTL caught up.
   */
  useEffect(() => {
    const answer = accepted[0];
    if (!answer) return;

    clearWaiting(answer.fromHandle);
    forget(answer.fromHandle);
    if (!offerRoom(answer.roomId)) router.push('/');
  }, [accepted, forget, router]);

  const accept = useCallback(async (invite: PendingInvite): Promise<InviteError | null> => {
    const res = await fetch(`/api/invites/${encodeURIComponent(invite.fromHandle)}/accept`, {
      method: 'POST',
    }).catch(() => null);

    if (!res) return { error: 'Could not reach the game server.' };
    if (!res.ok) return (await res.json().catch(() => ({}))) as InviteError;

    const { roomId } = (await res.json()) as AcceptResponse;
    dismiss(invite.fromHandle);

    /**
     * The invite is consumed by now and the room is made, so there is no path
     * from here that leaves anything recoverable. The code is handed over
     * before the navigation rather than after it, so a slow route change
     * cannot lose it.
     */
    if (!offerRoom(roomId)) router.push('/');
    return null;
  }, [dismiss, router]);

  /**
   * Withdraw an ask, so the player can go and start something else.
   *
   * One delete and it is gone — there is no room to tear down, no socket to
   * close and nobody to tell. That cheapness is the whole argument for making
   * an invite a row rather than an open room.
   */
  const cancel = useCallback(() => {
    if (!waiting) return;
    const { handle } = waiting;
    clearWaiting(handle);
    void fetch(`/api/me/friends/${encodeURIComponent(handle)}/invite`, {
      method: 'DELETE',
    }).catch(() => {});
  }, [waiting]);

  /**
   * Nothing during a duel.
   *
   * The server already stops sending invites to a busy player, so this is the
   * second of two guards — and the one that still holds for something that
   * arrived a moment before the match began. The pill goes too: a player who
   * started a duel while an ask was out has answered the question themselves.
   */
  if (busy) return null;
  if (invites.length === 0 && !waiting) return null;

  return (
    <div className={styles.dock} aria-live="polite">
      <InviteToast invites={invites} onAccept={accept} onDismiss={dismiss} />
      {waiting && <WaitingPill waiting={waiting} onCancel={cancel} />}
    </div>
  );
}
