/**
 * Lobby rooms.
 *
 * Mirrors `lib/rooms.ts` in keymania-api.
 */

/** A duel, or a four-way free-for-all. */
export const ROOM_SIZES = [2, 4] as const;
export type RoomSize = (typeof ROOM_SIZES)[number];

export type Visibility = 'public' | 'private';

/**
 * The room you are sitting in, before it is full enough to start.
 *
 * Held for hosts *and* joiners. Previously only a host had any notion of
 * waiting — it was set by `roomCreated`, which nobody else receives — so
 * somebody who joined a four-player room that was not yet full was left looking
 * at the lobby form with no sign anything had happened, and pressing Join again
 * was rewarded with "You are already in this duel."
 */
export interface WaitingRoom {
  code: string;
  /**
   * Null when you joined rather than hosted.
   *
   * Only the host is told whether the room is listed, because only the host
   * chose. The copy adapts rather than guessing.
   */
  visibility: Visibility | null;
  /** Everyone in so far, in slot order. Slot 0 is the host. */
  players: string[];
  capacity: number;
}

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
