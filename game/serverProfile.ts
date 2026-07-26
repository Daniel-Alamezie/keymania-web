'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The player's account-backed record.
 *
 * Every call goes through this app's own /api routes rather than straight to
 * the duel server, so the access token stays on the Next.js server — see
 * lib/upstream.ts.
 */

export interface DuelResult {
  wpm: number;
  accuracy: number;
  won: boolean;
  at: number;
  /** True only for duels the server refereed; bot practice is never ranked. */
  ranked: boolean;
  opponent?: string;
}

export interface ServerProfile {
  displayName: string;
  duels: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  bestCombo: number;
  bestRankedWpm: number;
  /** Newest first, as the API stores it. */
  history: DuelResult[];
}

export const NAME_MAX = 16;

export interface ProfileState {
  profile: ServerProfile | null;
  loading: boolean;
  /** Set when the record could not be loaded at all. */
  error: string | null;
  /** True when the caller is not signed in. */
  anonymous: boolean;
  saveName: (name: string) => Promise<{ ok: boolean; error?: string }>;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function useServerProfile(): ProfileState {
  const [profile, setProfile] = useState<ServerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);

  useEffect(() => {
    // Guards against a late response from an unmounted page overwriting state.
    let live = true;

    (async () => {
      try {
        const response = await fetch('/api/me/profile', { cache: 'no-store' });
        if (!live) return;

        if (response.status === 401) {
          setAnonymous(true);
          return;
        }
        if (!response.ok) {
          setError(await readError(response, 'Could not load your record.'));
          return;
        }
        setProfile((await response.json()) as ServerProfile);
      } catch {
        if (live) setError('Could not reach the duel server.');
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => { live = false; };
  }, []);

  const saveName = useCallback(async (name: string) => {
    const response = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
    });

    if (!response.ok) {
      return { ok: false, error: await readError(response, 'Could not save that name.') };
    }

    const { displayName } = (await response.json()) as { displayName: string };
    // Trust the server's version: it sanitises, so what came back may differ
    // from what was typed.
    setProfile((current) => (current ? { ...current, displayName } : current));
    // Keeps the account chip and the leaderboard in step without a reload.
    publishDisplayName(displayName);
    return { ok: true };
  }, []);

  return { profile, loading, error, anonymous, saveName };
}

/* -------------------------------------------------------------------------
 * The saved display name, shared.
 *
 * Two unrelated components want it at once — the account chip and the
 * leaderboard, which needs it to know which row is yours. A store rather than a
 * hook-per-component means one request rather than two, and it means saving a
 * new name on the dashboard updates the chip without a reload.
 *
 * Same shape as game/profile.ts: an external store read through
 * useSyncExternalStore, because the value does not exist during server
 * rendering and reading it during render would break hydration.
 * ---------------------------------------------------------------------- */

const nameListeners = new Set<() => void>();
/** null means "not loaded yet"; '' means "loaded, and they have not set one". */
let nameCache: string | null = null;
let nameRequest: Promise<void> | null = null;

function announceName() {
  nameListeners.forEach((notify) => notify());
}

function loadNameOnce() {
  nameRequest ??= (async () => {
    try {
      const response = await fetch('/api/me/profile', { cache: 'no-store' });
      nameCache = response.ok ? ((await response.json()) as ServerProfile).displayName : '';
    } catch {
      nameCache = '';
    }
    announceName();
  })();
}

/** Push a freshly saved name into the store so every reader updates at once. */
export function publishDisplayName(name: string): void {
  nameCache = name;
  announceName();
}

/** The saved name, or null while it is still being fetched. */
export function useDisplayName(): string | null {
  const subscribe = useCallback((listener: () => void) => {
    nameListeners.add(listener);
    // Kicked off from subscribe rather than render: this runs in an effect, so
    // it never fires during server rendering.
    loadNameOnce();
    return () => { nameListeners.delete(listener); };
  }, []);

  return useSyncExternalStore(subscribe, () => nameCache, () => null);
}

/** Recent form: the mean of the last few duels, which is what "current speed"
 *  actually means to a player — a single lucky run is not a level. */
export function currentSpeed(history: DuelResult[], sample = 5): number {
  const recent = history.slice(0, sample);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((sum, duel) => sum + duel.wpm, 0) / recent.length);
}

/**
 * Change between the older half and the newer half of the sampled window.
 *
 * Comparing halves rather than first-vs-last means one outlier cannot invent a
 * trend. Returns null when there is not enough history to say anything honest.
 */
export function trend(history: DuelResult[], sample = 10): number | null {
  const recent = history.slice(0, sample);
  if (recent.length < 4) return null;

  const half = Math.floor(recent.length / 2);
  // history is newest-first, so the first half is the *newer* one.
  const newer = recent.slice(0, half);
  const older = recent.slice(half);

  const mean = (list: DuelResult[]) => list.reduce((sum, d) => sum + d.wpm, 0) / list.length;
  return Math.round(mean(newer) - mean(older));
}
