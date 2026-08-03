'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/game/useAccount';
import { useHeartbeat } from '@/game/presence';
import { useBusy } from '@/game/busy';
import { offerRoom } from '@/game/joinIntent';
import type { InviteError, PendingInvite } from '@/models/invites';
import InviteToast from './InviteToast';

/**
 * The heartbeat and the invite toast, above every page.
 *
 * Both used to live inside the arena and the profile dashboard, which meant
 * two things went wrong at once. An invite that arrived while somebody was
 * reading the leaderboard was invisible for its whole ninety seconds, and the
 * heartbeat stopped entirely on any page that was neither of those two — so a
 * player browsing the boards looked offline to their friends.
 *
 * Mounted once here, both problems are the same problem and it is solved: the
 * player is present wherever they are, and an invite reaches them wherever
 * they are.
 *
 * Renders nothing at all when signed out, which is most visitors. The hook
 * below does no work without an account.
 */
export default function InviteHost() {
  const account = useAccount();
  const busy = useBusy();
  const router = useRouter();

  /**
   * Busy comes from the arena rather than from the route.
   *
   * Guessing from the pathname would be wrong in both directions: `/` is the
   * menu as often as it is a duel, and a player who navigated away mid-match
   * has left the game rather than paused it. Only the arena knows.
   */
  const { invites, dismiss } = useHeartbeat(account.signedIn, busy);

  const accept = useCallback(async (invite: PendingInvite): Promise<InviteError | null> => {
    const res = await fetch(`/api/invites/${encodeURIComponent(invite.fromHandle)}/accept`, {
      method: 'POST',
    }).catch(() => null);

    if (!res) return { error: 'Could not reach the game server.' };
    if (!res.ok) return (await res.json().catch(() => ({}))) as InviteError;

    const { roomId } = (await res.json()) as { roomId: string };
    dismiss(invite.fromHandle);

    /**
     * The arena joins, wherever it is.
     *
     * If it is already on screen it takes the code directly and the player is
     * in the duel without a navigation. If they were on some other page it
     * parks the code and this sends them to the arena, which picks it up as it
     * mounts. Either way the invite has been consumed by now, so there is no
     * path where a failure here leaves it recoverable — which is why the code
     * is handed over before the navigation rather than after it.
     */
    if (!offerRoom(roomId)) router.push('/');
    return null;
  }, [dismiss, router]);

  /**
   * Nothing during a duel.
   *
   * Belt and braces: the server already stops sending invites to a busy
   * player, so this is the second of two guards. It is the cheaper one to be
   * sure of, and it is the one that still holds for an invite that arrived a
   * moment before the match began.
   */
  if (busy) return null;

  return <InviteToast invites={invites} onAccept={accept} onDismiss={dismiss} />;
}
