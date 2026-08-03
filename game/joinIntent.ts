'use client';

import { useEffect } from 'react';

/**
 * "Take me into this room", from wherever the invite was accepted.
 *
 * The toast now floats above every page, so Accept can be pressed on the
 * leaderboard, on a profile, or on the menu — but only the arena holds a
 * socket, so only the arena can actually join. This carries the room code the
 * short distance between them.
 *
 * Two paths, because there are genuinely two cases. If the arena is already on
 * screen it is listening, and handing it the code directly is instant. If the
 * player is on another page it is not mounted at all, so the code goes into
 * `sessionStorage` and is picked up when it mounts. Trying to serve both with
 * only storage would work and would cost a navigation the player does not
 * need; trying to serve both with only a listener would silently drop every
 * accept made outside the arena.
 */

const KEY = 'keymania.join';

let listener: ((roomId: string) => void) | null = null;

/**
 * Hand a room to the arena, and say whether it was taken.
 *
 * `false` means nobody was listening, so the caller has to navigate — which it
 * can do knowing the code is already parked and waiting.
 */
export function offerRoom(roomId: string): boolean {
  if (listener) {
    listener(roomId);
    return true;
  }
  try {
    window.sessionStorage.setItem(KEY, roomId);
  } catch {
    // Private browsing, or storage disabled. The navigation still happens and
    // the player lands in the arena; they will need to be invited again.
  }
  return false;
}

/** Read a parked room and forget it, so a refresh cannot rejoin twice. */
export function takeRoom(): string | null {
  try {
    const roomId = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return roomId;
  } catch {
    return null;
  }
}

/**
 * Listen for rooms while the arena is on screen.
 *
 * One listener at a time by design: there is only ever one arena, and a second
 * registration means a mounting copy replacing an unmounting one during a
 * transition. Keeping the newest is the right resolution for that.
 */
export function useRoomOffers(onRoom: (roomId: string) => void): void {
  useEffect(() => {
    listener = onRoom;
    return () => {
      if (listener === onRoom) listener = null;
    };
  }, [onRoom]);
}
