/**
 * Lobby rooms.
 *
 * Mirrors `lib/rooms.ts` in keymania-api.
 */

/** A duel, or a four-way free-for-all. */
export const ROOM_SIZES = [2, 4] as const;
export type RoomSize = (typeof ROOM_SIZES)[number];

export type Visibility = 'public' | 'private';

/** A joinable room, as the lobby list shows it. */
export interface RoomSummary {
  roomId: string;
  host: string;
  createdAt: number;
  /**
   * Occupancy. Optional because rooms created before sizes existed carry
   * neither field — treat a missing capacity as a duel.
   */
  players?: number;
  capacity?: RoomSize;
}
