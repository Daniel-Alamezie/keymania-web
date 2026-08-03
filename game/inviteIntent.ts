'use client';

/**
 * "Invite Wren", carried from the profile page to the arena.
 *
 * The friends list lives on the profile page and the socket lives in the
 * arena, so the button and the thing it does are on two different screens.
 * Rather than give the profile page its own socket — a second connection, a
 * second set of room messages to handle, for one button — the click records
 * an intention and sends the player where games actually happen.
 *
 * `sessionStorage` rather than a query parameter, because a handle in the URL
 * would survive a bookmark, a share and a back button, and every one of those
 * would silently open a private room for somebody the player was not thinking
 * about. This is read exactly once and cleared as it is read.
 */

const KEY = 'keymania.invite';

export function rememberInvite(handle: string): void {
  try {
    window.sessionStorage.setItem(KEY, handle);
  } catch {
    // Private browsing, or storage disabled. The navigation still happens and
    // the player lands in the arena, which is a worse outcome than intended
    // but not a broken one. Nothing here is worth an error message.
  }
}

/** Read it and forget it, so a refresh does not invite somebody twice. */
export function takeInvite(): string | null {
  try {
    const handle = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return handle;
  } catch {
    return null;
  }
}
