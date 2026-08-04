'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Friend, FriendsResponse } from '@/models/friends';

/**
 * The friends list.
 *
 * Deliberately plain state rather than the shared store used for the profile.
 * That store exists because several components independently wanted the same
 * record and were each fetching it; this is read by one panel at a time, and
 * giving it a module-level cache would be machinery in search of a problem.
 *
 * It also *should* go stale. A profile changes when you change it, so caching
 * it for a minute is free — but a friend request arrives when somebody else
 * decides to send one, and the only way to find out is to ask again.
 */

/**
 * How often the list re-asks while somebody is looking at it.
 *
 * It used to ask once and never again, which was defensible when a row said
 * only who somebody was — a name does not change while you read it. Presence
 * broke that: the list now carries a fact that changes on its own, and players
 * reported having to reload the page to see a friend come online. They were
 * right, and it was a bug rather than a decision.
 *
 * Slower than the heartbeat on purpose. Fifteen seconds is the rate at which
 * presence is *reported*, and matching it here would double the traffic to
 * halve a delay nobody can perceive: a dot that is up to half a minute behind
 * still answers "is it worth asking them" correctly.
 *
 * This is also a genuinely more expensive request than the heartbeat — one
 * read per friend — which is affordable only because it stops the moment
 * nobody is looking. See below.
 */
const POLL_MS = 30_000;

const EMPTY: FriendsResponse = { friends: [], incoming: [], outgoing: [], blocked: 0 };

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const { error } = (await response.json()) as { error?: string };
    return error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetching is separated from applying so that every caller can decide whether
 * the answer is still wanted. Setting state inside the fetch itself is how a
 * response that arrives after unmount ends up writing to a component that is no
 * longer there.
 */
type Loaded =
  | { ok: true; data: FriendsResponse }
  | { ok: false; error: string | null };

/**
 * @param weekly Ask for each friend's weekly sprint too.
 *
 * Off by default because it is the expensive half: weekly results live in their
 * own rows upstream, so filling them in is one extra read per friend, up to
 * sixty on a full list. The friends panel never needs them; only the weekly
 * friends board does, and only while somebody is looking at it.
 */
async function load(weekly = false): Promise<Loaded> {
  try {
    const path = weekly ? '/api/me/friends?include=weekly' : '/api/me/friends';
    const response = await fetch(path, { cache: 'no-store' });
    // Signed out is not an error worth showing — it is just an empty list.
    if (response.status === 401) return { ok: true, data: EMPTY };
    if (!response.ok) {
      return { ok: false, error: await readError(response, 'Could not load your friends.') };
    }
    return { ok: true, data: (await response.json()) as FriendsResponse };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

export interface FriendsState {
  data: FriendsResponse;
  loading: boolean;
  error: string | null;
  /** True while any write is in flight, so the panel can disable itself. */
  busy: boolean;
  refresh: () => Promise<void>;
  add: (handle: string) => Promise<{ ok: boolean; error?: string }>;
  accept: (handle: string) => Promise<{ ok: boolean; error?: string }>;
  remove: (handle: string) => Promise<{ ok: boolean; error?: string }>;
  block: (handle: string) => Promise<{ ok: boolean; error?: string }>;
}

export function useFriends(
  enabled: boolean,
  /**
   * Ask for each friend's weekly sprint as well.
   *
   * Only the weekly friends board wants this, and only while it is on screen —
   * it is one extra upstream read per friend. Part of the effect's dependency
   * list, so turning it on refetches immediately rather than waiting out a
   * thirty-second poll with the column blank.
   */
  weekly = false,
): FriendsState {
  const [data, setData] = useState<FriendsResponse>(EMPTY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);

  const apply = useCallback((result: Loaded) => {
    if (!live.current) return;
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Guarded inside the async body rather than by a flag set here, so a second
    // render with the same `enabled` cannot leave the first fetch orphaned.
    let current = true;
    const ask = () => { void load(weekly).then((result) => { if (current) apply(result); }); };

    ask();
    let timer = setInterval(ask, POLL_MS);

    /**
     * Nothing happens while the tab is in the background.
     *
     * A friends list is only worth refreshing for somebody who can see it, and
     * without this a tab left open behind twelve others would fan out a read
     * per friend every thirty seconds, all night, to update a list nobody is
     * looking at. Coming back asks immediately rather than waiting out the
     * remainder of an interval, so returning to the tab shows the truth rather
     * than whatever was true when it was hidden.
     */
    const onVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') {
        ask();
        timer = setInterval(ask, POLL_MS);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, weekly, apply]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    apply(await load(weekly));
  }, [enabled, weekly, apply]);

  /**
   * Every write re-reads the list rather than patching it locally.
   *
   * Accepting a request moves somebody between two lists, sending one may
   * *also* accept theirs if they got there first, and blocking removes a row
   * and changes a count. Reproducing those rules in the browser would mean two
   * implementations of the same logic that have to agree — which is exactly the
   * duplication this codebase has been bitten by before.
   */
  const write = useCallback(async (
    path: string,
    init: RequestInit,
    fallback: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    setBusy(true);
    try {
      const response = await fetch(path, {
        headers: { 'content-type': 'application/json' },
        ...init,
      });
      if (!response.ok) return { ok: false, error: await readError(response, fallback) };
      apply(await load());
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not reach the server.' };
    } finally {
      if (live.current) setBusy(false);
    }
  }, [apply]);

  const encoded = (handle: string) => `/api/me/friends/${encodeURIComponent(handle)}`;

  return {
    data,
    loading,
    error,
    busy,
    refresh,
    add: (handle) => write(
      '/api/me/friends',
      { method: 'POST', body: JSON.stringify({ handle }) },
      'Could not send that request.',
    ),
    accept: (handle) => write(encoded(handle), { method: 'PUT', body: '{}' }, 'Could not accept.'),
    remove: (handle) => write(encoded(handle), { method: 'DELETE' }, 'Could not remove.'),
    block: (handle) => write(
      encoded(handle),
      { method: 'PUT', body: JSON.stringify({ action: 'block' }) },
      'Could not block.',
    ),
  };
}

/** Someone worth showing in a list. */
export type { Friend };
