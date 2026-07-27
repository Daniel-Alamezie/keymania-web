/**
 * The duel protocol — every message that crosses the WebSocket.
 *
 * API Gateway holds the socket and a Lambda runs per message, so each of these
 * is self-contained: there is no connection-scoped memory on the server beyond
 * what the rooms table holds.
 *
 * The server is the authority. Anything a client sends is a claim to be
 * checked, never a fact — which is why nothing here lets a client state its own
 * damage or health.
 */

import type { PowerKind } from './powers';
import type { RoomSize, RoomSummary, Visibility } from './room';

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type ServerMessage =
  | {
    type: 'roomCreated';
    roomId: string;
    visibility: Visibility;
    capacity?: RoomSize;
    slot: number;
    you: string;
  }
  | { type: 'roomList'; rooms: RoomSummary[] }
  /** A room filling up, before it is full enough to start. */
  | { type: 'roomFilling'; roomId: string; players: string[]; capacity: number }
  | {
    type: 'matchStart';
    roomId: string;
    script: string[];
    /** Charged words keyed by flat word index. */
    powers: Record<number, PowerKind>;
    countdownMs: number;
    slot: number;
    you: string;
    /** Every player's name in slot order. */
    roster: string[];
    /** Legacy single-opponent name, sent only for two-player rooms. */
    opponent?: string;
  }
  | {
    type: 'hit';
    fromSlot: number;
    /** Who wore it. Past two players this cannot be inferred from fromSlot. */
    toSlot: number;
    damage: number;
    tier: number;
    combo: number;
    wpm: number;
    healths: number[];
    progress: number[];
    /** Power the thrower just collected, if the word was charged. */
    granted?: PowerKind;
    /** The target's ward absorbed this blade. */
    blocked?: boolean;
    /** The throw was doubled by a surge. */
    surged?: boolean;
    wards?: boolean[];
    surges?: boolean[];
    /** Who each fighter now aims at, recomputed after the damage. */
    targets?: number[];
    /** Set when this blow knocked somebody out. */
    eliminatedSlot?: number;
  }
  /** Somebody is out, but others are still fighting. Four-way only. */
  | {
    type: 'eliminated';
    slot: number;
    reason?: 'resign' | 'left';
    healths: number[];
    targets?: number[];
  }
  | { type: 'gameOver'; winnerSlot: number; reason?: 'resign' | 'left' }
  /**
   * Who has asked to go again, after a duel has finished.
   *
   * Sent to everyone in the room, including the people who have not answered —
   * waiting is much easier when you can see what you are waiting for. The
   * roster can shrink between messages: somebody leaving the result screen
   * drops out of it rather than taking the room with them.
   */
  | { type: 'rematchState'; players: string[]; ready: boolean[] }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };

export type ClientMessage =
  // `token` is a Kinde access token. The server refuses both of these without
  // one — a duel has to be attributable to an account before it can count.
  | {
    action: 'createRoom';
    name: string;
    visibility: Visibility;
    token: string;
    /** How many players the room waits for. Omitted means a duel. */
    capacity?: RoomSize;
  }
  | { action: 'joinRoom'; roomId: string; name: string; token: string }
  | { action: 'listRooms' }
  // Running accuracy rides along here rather than on its own route. The server
  // cannot verify it, so it is stored for the player's record but never ranked.
  //
  // `typos` is how many mistakes were made inside this word. The server needs
  // it because a wrong key never reaches it: the cursor does not advance, so no
  // message is sent, and without this its combo runs on where yours broke.
  //
  // Client-reported and therefore imperfect — under-reporting keeps a streak
  // you lost. It is the same trust as elapsedMs, which the server already
  // accepts and clamps, and lying only helps in one direction.
  | { action: 'wordComplete'; word: string; elapsedMs: number; accuracy?: number; typos?: number }
  | { action: 'resign' }
  /**
   * Another duel with the people already here.
   *
   * Needs no room code: the server knows which room this socket is in, and the
   * room now outlives the match that was played in it. Unanimous among whoever
   * is still connected — a rematch is not something you can decline once it has
   * started.
   */
  | { action: 'rematch' };
