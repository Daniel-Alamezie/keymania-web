/**
 * The wire contract with keymania-api.
 *
 * Mirrors the routes and payloads documented in that repo's README. Keeping it
 * in one typed file means a protocol change breaks the build rather than
 * failing silently at runtime.
 */

import type { PowerKind } from './powers';

/** A duel, or a four-way free-for-all. Mirrors ROOM_SIZES in the API. */
export const ROOM_SIZES = [2, 4] as const;
export type RoomSize = (typeof ROOM_SIZES)[number];

export interface RoomSummary {
  roomId: string;
  host: string;
  createdAt: number;
  /** Absent on rooms created before sizes existed; treat as a duel. */
  players?: number;
  capacity?: RoomSize;
}

export type ServerMessage =
  | { type: 'roomCreated'; roomId: string; visibility: 'public' | 'private'; slot: number; you: string }
  | { type: 'roomList'; rooms: RoomSummary[] }
  | {
      type: 'matchStart';
      roomId: string;
      script: string[];
      /** Charged words keyed by flat word index. */
      powers: Record<number, PowerKind>;
      countdownMs: number;
      slot: number;
      you: string;
      opponent: string;
    }
  | {
      type: 'hit';
      fromSlot: number;
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
    }
  | { type: 'gameOver'; winnerSlot: number; reason?: 'resign' }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };

export type ClientMessage =
  // `token` is a Kinde access token. The server refuses both of these without
  // one — a duel has to be attributable to an account before it can count.
  | {
      action: 'createRoom';
      name: string;
      visibility: 'public' | 'private';
      token: string;
      /** How many players the room waits for. Omitted means a duel. */
      capacity?: RoomSize;
    }
  | { action: 'joinRoom'; roomId: string; name: string; token: string }
  | { action: 'listRooms' }
  // Running accuracy rides along here rather than on its own route. The server
  // cannot verify it, so it is stored for the player's record but never ranked.
  | { action: 'wordComplete'; word: string; elapsedMs: number; accuracy?: number }
  | { action: 'resign' };

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
