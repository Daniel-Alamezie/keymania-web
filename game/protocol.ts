/**
 * The wire contract with keymania-api.
 *
 * Mirrors the routes and payloads documented in that repo's README. Keeping it
 * in one typed file means a protocol change breaks the build rather than
 * failing silently at runtime.
 */

export interface RoomSummary {
  roomId: string;
  host: string;
  createdAt: number;
}

export type ServerMessage =
  | { type: 'roomCreated'; roomId: string; visibility: 'public' | 'private'; slot: number; you: string }
  | { type: 'roomList'; rooms: RoomSummary[] }
  | {
      type: 'matchStart';
      roomId: string;
      script: string[];
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
    }
  | { type: 'gameOver'; winnerSlot: number; reason?: 'resign' }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };

export type ClientMessage =
  | { action: 'createRoom'; name: string; visibility: 'public' | 'private' }
  | { action: 'joinRoom'; roomId: string; name: string }
  | { action: 'listRooms' }
  | { action: 'wordComplete'; word: string; elapsedMs: number }
  | { action: 'resign' };

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
