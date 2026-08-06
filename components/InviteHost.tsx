'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/game/useAccount';
import { useHeartbeat } from '@/game/presence';
import { useBusy } from '@/game/busy';
import { clearWaiting, useWaiting } from '@/game/waiting';
import { hostingActions, useHosting } from '@/game/hosting';
import { offerRoom } from '@/game/joinIntent';
import { useChallenges } from '@/game/serverProfile';
import { useNewChallenges } from '@/game/seenChallenges';
import type { AcceptResponse, InviteError, PendingInvite } from '@/models/invites';
import ChallengeToast from './ChallengeToast';
import InviteToast from './InviteToast';
import WaitingPill from './WaitingPill';
import HostingPill from './HostingPill';
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
  /* The room this player left open, if any. See game/hosting.ts for why the
     actions arrive separately from the state. */
  const hosting = useHosting();
  const actions = hostingActions();
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
   * Challenges this browser has not announced yet.
   *
   * Read here because this component already owns the corner announcements
   * live in — a second fixed dock would stack two corners on each other,
   * which is the collision the dock comment below the toast warns about.
   * The store hands back its own stable array, so this costs nothing when
   * there is no news.
   */
  const challenges = useChallenges();
  const fresh = useNewChallenges(challenges);

  /**
   * Nothing during a duel, with one exception.
   *
   * The server already stops sending invites to a busy player, so this is the
   * second of two guards — and the one that still holds for something that
   * arrived a moment before the match began. The invite pill goes too: a player
   * who started a duel while an ask was out has answered the question
   * themselves. The challenge notice waits with them: news can be told after
   * the match, and mid-duel is the one moment nothing may compete for the eye.
   *
   * The exception is below.
   */
  /**
   * The one thing that outranks being mid-game.
   *
   * `busy` clears this corner because nothing should compete for the eye
   * during a duel — but a room this player opened that has now filled is not
   * an interruption from outside, it is a person sitting waiting because of
   * something they did. And the wait is only ending when they press it.
   *
   * Held, specifically, and not merely hosting. A passive "1 of 2" during a
   * duel would be exactly the noise the rule above exists to prevent; the
   * question is what earns the exception.
   */
  const held = hosting?.held ? hosting : null;

  if (busy && !held) return null;
  if (busy && held) {
    return (
      <div className={styles.dock} aria-live="polite">
        <HostingPill
          hosting={held}
          onStart={() => actions?.start()}
          onCancel={() => actions?.cancel()}
          onOpen={() => actions?.open()}
        />
      </div>
    );
  }

  if (invites.length === 0 && !waiting && !hosting && fresh.length === 0) return null;

  return (
    <div className={styles.dock} aria-live="polite">
      <InviteToast invites={invites} onAccept={accept} onDismiss={dismiss} />
      {waiting && <WaitingPill waiting={waiting} onCancel={cancel} />}
      {/* Your own open room, above the game's announcements for the same
          reason a person asking does: somebody is waiting on you. */}
      {hosting && (
        <HostingPill
          hosting={hosting}
          onStart={() => actions?.start()}
          onCancel={() => actions?.cancel()}
          onOpen={() => actions?.open()}
        />
      )}
      {/* Below the invites: a person asking outranks the game announcing. */}
      {fresh.length > 0 && <ChallengeToast challenges={challenges} fresh={fresh} />}
    </div>
  );
}
