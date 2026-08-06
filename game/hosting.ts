'use client';

import { useSyncExternalStore } from 'react';

/**
 * The room this player is hosting, while they are off doing something else.
 *
 * The lobby's answer to the same problem invites solved, arrived at from the
 * opposite direction. An invite could stop holding a room entirely — that is
 * why `waiting.ts` exists and why an inviter can wander. A hosted room cannot
 * make that trade: it has to exist in order to be listed and joined.
 *
 * What made wandering possible anyway is that the socket belongs to the page
 * rather than to the screen. It always did; the only thing pinning a host to
 * the waiting room was the Back button calling `disconnect()`, which deleted
 * the room out from under them. Leaving now keeps the connection and moves the
 * room into this store instead.
 *
 * Kept out of the page tree for the same reason the invite pill is: somebody
 * joins on nobody's schedule but their own, so whatever reports it has to
 * outlive whichever screen the host happens to be looking at.
 *
 * No countdown here, unlike `Waiting`. An invite dies in ninety seconds and its
 * clock is honest; a hosted room lives for hours and has no deadline worth
 * showing. What moves instead is the occupancy.
 */

export interface Hosting {
  /** The room code, which is also what the pill offers to copy. */
  code: string;
  /** Everyone in so far, in slot order. Slot 0 is this player. */
  players: string[];
  capacity: number;
  /** Played for nothing. Shown, so the host can see which room this is. */
  friendly: boolean;
  /**
   * Full, and waiting on this player to say go.
   *
   * The server holds a room that fills while its host is away rather than
   * arming it, because the duel's clock starts on filling and cannot be paused
   * afterwards. Until this is true the pill is passive; once it is, the pill is
   * the only thing standing between two people and a duel.
   */
  held: boolean;
}

let hosting: Hosting | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((notify) => notify());

export function setHosting(next: Hosting): void {
  hosting = next;
  emit();
}

/**
 * Update what is known without disturbing the rest.
 *
 * Somebody arriving and the host being asked to start are two different
 * messages about one room, and each carries only its own half.
 */
export function updateHosting(patch: Partial<Hosting>): void {
  if (!hosting) return;
  hosting = { ...hosting, ...patch };
  emit();
}

export function clearHosting(): void {
  if (!hosting) return;
  hosting = null;
  emit();
}

export function subscribeHosting(notify: () => void): () => void {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}

export const hostingSnapshot = (): Hosting | null => hosting;

/** Nothing is being hosted on the server, which cannot know either way. */
export const hostingServerSnapshot = (): Hosting | null => null;

export const useHosting = (): Hosting | null => useSyncExternalStore(
  subscribeHosting,
  hostingSnapshot,
  hostingServerSnapshot,
);

/**
 * What the pill can do, registered by whoever owns the socket.
 *
 * The awkward part of this feature, and worth explaining rather than hiding. A
 * hosted room is not a row on a server that any page can act on — it is a live
 * websocket held by one component, `Game`. But the pill has to render above
 * every page, exactly like its invite sibling, or a host who wandered into a
 * lesson would never see the question.
 *
 * So the state lives here and the *actions* are lent here, by the one component
 * that can perform them. The alternative was threading a pill through every
 * screen `Game` returns, which is a dozen render sites that would each have to
 * remember it, and the first one anybody forgot would be a host stuck in a
 * lesson with a friend waiting and nothing on screen.
 *
 * Re-registered whenever the callbacks change, so nothing here is ever holding
 * a stale `send`.
 */
export interface HostingActions {
  /** Arm the duel that is waiting on this player. */
  start: () => void;
  /** Give the room up entirely. */
  cancel: () => void;
  /** Back to the waiting room, for somebody who wants the code. */
  open: () => void;
}

let actions: HostingActions | null = null;

export function setHostingActions(next: HostingActions | null): void {
  actions = next;
  emit();
}

export const hostingActions = (): HostingActions | null => actions;
