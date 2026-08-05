'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

/**
 * Which challenges this browser has already told its player about.
 *
 * The sibling of `seenCosmetics`, for the other end of the pipeline: that one
 * notices rewards that have quietly *landed*, this one notices challenges that
 * have quietly *opened*. A content drop ships a new challenge to every account
 * at once, and without this the only way to find out is to open the Challenges
 * tab on a hunch — which is the same hunch the cosmetics dot replaced, one
 * screen earlier.
 *
 * Device-level for the same reason as the cosmetics list: whether you have
 * been told is a fact about this browser, and two devices each mentioning a
 * new challenge once is correct — nobody told you on that one yet.
 *
 * Ids rather than a count or a timestamp. A count cannot survive two drops
 * landing before one visit, and a timestamp would need the challenge list to
 * carry "added at", which the API deliberately does not store — challenges are
 * derived, not dated.
 */

const KEY = 'keymania.seenChallenges';

const listeners = new Set<() => void>();

function read(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    // Validated rather than trusted: a corrupted value must not throw inside a
    // render. Unknown shape reads as "nothing recorded", which re-announces at
    // worst — the direction of failure that loses nothing.
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return null;
  }
}

/**
 * The decision, pure so it can be tested without a browser.
 *
 * `stored === null` — no record at all — means this is a first visit, and a
 * first visit announces nothing: to a player who has never seen the list,
 * nothing on it is "new", *they* are. Telling a brand-new player about twenty
 * new challenges on their first paint is the notification crying wolf on
 * arrival. The caller seeds the record silently instead (see the hook below).
 *
 * An empty stored list is different: it is a record that says "I had seen
 * everything, and everything was nothing" — so anything current genuinely is
 * news. The null/[] distinction carries the whole feature, which is why this
 * returns the seed decision rather than leaving the caller to infer it.
 */
export function challengeNews(
  current: string[],
  stored: string[] | null,
): { fresh: string[]; seed: boolean } {
  // No challenges yet — profile still loading, or signed out. Saying nothing
  // is the only honest answer, and seeding now would write an empty baseline
  // that turns the real list into "news" the moment it arrives.
  if (current.length === 0) return { fresh: [], seed: false };
  if (stored === null) return { fresh: [], seed: true };
  const seen = new Set(stored);
  return { fresh: current.filter((id) => !seen.has(id)), seed: false };
}

/**
 * Mark these challenges as announced.
 *
 * A union rather than a replacement, like the cosmetics list: a challenge
 * that closes (a weekly, say) and later returns must not become news again
 * for somebody who was told the first time.
 */
export function markChallengesSeen(ids: string[]): void {
  try {
    const merged = [...new Set([...(read() ?? []), ...ids])];
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* private mode — the toast will simply return next visit */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Dismissing the toast in another tab counts as having been told.
  window.addEventListener('storage', notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', notify);
  };
}

/**
 * The challenge ids this player has not been told about, or none.
 *
 * The server snapshot is the raw string `null`, so the first client render
 * matches the server's and hydration cannot mismatch — the toast appears a
 * frame later, which nobody can see, rather than the page failing to hydrate.
 *
 * The first-visit seed runs in an effect, not in render: it writes storage,
 * and an impure render is the rule this codebase has now tripped over three
 * times (see useBoard's note).
 */
export function useNewChallenges(challenges: readonly { id: string }[]): string[] {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY), () => null);
  // Memoed on the store's array, which is reference-stable between fetches —
  // a fresh ids array every render would re-run the seeding effect forever.
  const ids = useMemo(() => challenges.map((c) => c.id), [challenges]);
  const { fresh, seed } = challengeNews(ids, raw === null ? null : read());

  useEffect(() => {
    if (seed) markChallengesSeen(ids);
  }, [seed, ids]);

  return fresh;
}
