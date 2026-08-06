'use client';

import { INVITE_MS } from '@/models/invites';
import { clearWaiting, setWaiting } from './waiting';

/**
 * Ask a friend for a game, from wherever the button was pressed.
 *
 * No navigation, no room, no socket. That is the entire change: an invite used
 * to open a private room and pin the sender to a waiting screen holding it
 * open, because the room only lived as long as their connection did. Leaving
 * that screen deleted the room out from under the friend about to accept, so
 * "let me carry on browsing" was not a missing feature but a structural
 * impossibility.
 *
 * Now it writes a row. The pill in the corner is the only thing that changes on
 * screen, and the player carries on with whatever they were doing.
 *
 * The pill is raised *before* the request resolves, so pressing Invite feels
 * immediate; a failure takes it straight back down. The alternative — waiting
 * on the server before acknowledging the click — makes the button feel broken
 * on a slow connection, which is the state this is most likely to be used in.
 */
export async function sendInvite(
  handle: string,
  name?: string,
  /**
   * Played for nothing.
   *
   * Passed with the ask rather than settled later, because the row the server
   * writes is what the other person reads before answering. There is no room
   * yet to attach it to, and by the time there is, they have already agreed.
   */
  friendly = false,
): Promise<string | null> {
  const optimistic = {
    handle,
    name: name || `@${handle}`,
    friendly,
    expiresAt: Date.now() + INVITE_MS,
  };
  setWaiting(optimistic);

  const res = await fetch(`/api/me/friends/${encodeURIComponent(handle)}/invite`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ friendly }),
  }).catch(() => null);

  if (res?.ok) return null;

  /**
   * Only clear the pill if it is still *this* ask.
   *
   * A slow failure must not wipe out an invite the player has since sent to
   * somebody else. Comparing the handle is what makes that safe, and it is
   * why `clearWaiting` takes one at all.
   */
  clearWaiting(handle);

  const problem = res ? await res.json().catch(() => ({})) : {};
  return (problem as { error?: string }).error ?? 'That invite could not be sent.';
}
