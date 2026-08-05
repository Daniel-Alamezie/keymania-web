'use client';

/**
 * The duel this tab is currently in, so a refresh does not abandon it.
 *
 * Everything needed to pick a duel back up already existed: the server keeps
 * the room alive through a dropped connection, `rejoin` hands back the full
 * state, and the client knows how to rebuild a match from it — that is how a
 * locked phone or a network handover is survived. All of it hangs off one
 * thing the client had to remember, and a page reload was the one kind of
 * disconnect that forgot it: the room id lived in React state and died with
 * the component.
 *
 * So the id is parked here for the length of a live duel. Nothing else — the
 * server holds the score, the healths and whose turn it is, and a second copy
 * of any of that would be a second thing to be wrong.
 *
 * `sessionStorage`, deliberately. A duel belongs to this tab: reopening the
 * site tomorrow should not try to rejoin a match from last night, and two
 * tabs should not fight over one seat. It also means a closed tab forgets,
 * which is correct — that is a player who left, not one who refreshed.
 *
 * Multiplayer only. A bot duel has no room and no server state; there is
 * nothing to rejoin, and pretending otherwise would send a reclaim for a
 * room that never existed.
 */

const KEY = 'keymania.liveDuel';

/** Remember the room, for as long as the duel is live. */
export function rememberDuel(roomId: string): void {
  try {
    window.sessionStorage.setItem(KEY, roomId);
  } catch {
    /* Private mode. A refresh mid-duel loses the seat, as it did before. */
  }
}

/**
 * Forget it. Called on every way a duel ends — leaving, a winner, a refused
 * rejoin — because a stale id means the next page load reclaims a seat at a
 * table nobody is sitting at, and the failure of that is a confusing error
 * rather than a quiet no-op.
 */
export function forgetDuel(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing stored, nothing to clear. */
  }
}

/** The room to reclaim on load, if this tab was in one. */
export function liveDuel(): string | null {
  try {
    const roomId = window.sessionStorage.getItem(KEY);
    /* Same bound the server puts on a room id: anything else was not written
       by us, and sending it would earn a refusal at best. */
    return roomId && roomId.length <= 12 ? roomId : null;
  } catch {
    return null;
  }
}
