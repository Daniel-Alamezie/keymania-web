'use client';

// The store owns all the state, so nothing here needs local React state.
import { useSyncExternalStore } from 'react';
import { asCharacter, DEFAULT_CHARACTER, type CharacterId } from '@/models/character';
import type {
  ChallengeProgress, DuelResult, ServerProfile, Tally,
} from '@/models/profile';




export const EMPTY_TALLY: Tally = {
  duels: 0, wins: 0, bestWpm: 0, bestAccuracy: 0, bestCombo: 0,
};

/** Percentage of duels won, or null when there are none to divide by. */
export function winRate(tally: Tally): number | null {
  return tally.duels === 0 ? null : Math.round((tally.wins / tally.duels) * 100);
}

export const NAME_MAX = 16;
/** Mirrors HANDLE_MAX in keymania-api/src/lib/handles.ts. */
export const HANDLE_MAX = 16;

export interface ProfileState {
  profile: ServerProfile | null;
  loading: boolean;
  /** Set when the record could not be loaded at all. */
  error: string | null;
  /** True when the caller is not signed in. */
  anonymous: boolean;
  saveName: (name: string) => Promise<{ ok: boolean; error?: string }>;
  saveHandle: (handle: string) => Promise<{ ok: boolean; error?: string }>;
  saveCharacter: (character: CharacterId) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Equip a badge, title or name colour. `null` takes one off; an omitted
   * field is left alone, which is what lets the panel send one change at a
   * time rather than restating the player's whole appearance every click.
   */
  saveCosmetics: (
    wanted: { title?: string | null; badge?: string | null; nameColour?: string | null },
  ) => Promise<{ ok: boolean; error?: string }>;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------
 * The store.
 *
 * One cache for the whole record, shared by everything that needs any part of
 * it. Previously the account chip and the dashboard each fetched /api/me/profile
 * on their own terms, so opening the dashboard threw away a copy the menu had
 * already loaded and fetched it again — with a blocking spinner, every time.
 *
 * Stale-while-revalidate: whatever is cached renders immediately, and the
 * request that follows only confirms it. The record barely changes, so serving
 * a slightly old copy for a moment costs nothing, and waiting on the network
 * before showing anything costs a visibly slow page.
 *
 * Persisted to localStorage so this survives a hard refresh too, not just
 * client-side navigation.
 * ---------------------------------------------------------------------- */

/** Distinct from game/profile.ts's `keymania.profile.v1`, which is the local
 *  bot-practice record and a different thing entirely. */
const CACHE_KEY = 'keymania.account.v1';
/** Superseded by caching the whole record; removed on first run. */
const LEGACY_NAME_KEY = 'keymania.displayName.v1';

/**
 * How long a cached record is served without re-checking.
 *
 * It only changes when this player finishes a duel or renames themselves, and
 * both of those invalidate the cache directly. This window exists purely for
 * changes made somewhere else — another tab, another device — so it can be
 * generous.
 */
const STALE_AFTER_MS = 60_000;

interface Snapshot {
  profile: ServerProfile | null;
  loading: boolean;
  error: string | null;
  anonymous: boolean;
}

/** Stable reference: useSyncExternalStore compares snapshots by identity, so a
 *  fresh object per call would re-render forever. */
const EMPTY: Snapshot = { profile: null, loading: true, error: null, anonymous: false };

let snapshot: Snapshot = EMPTY;
let fetchedAt = 0;
let hydrated = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(change: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...change };
  listeners.forEach((notify) => notify());
}

/** Idempotent, and safe to call from getSnapshot: it always produces the same
 *  result once run, so React sees a consistent value. */
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(LEGACY_NAME_KEY);
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;

    const { profile, at } = JSON.parse(raw) as { profile: ServerProfile; at: number };
    if (profile) {
      snapshot = { profile, loading: false, error: null, anonymous: false };
      fetchedAt = at;
    }
  } catch {
    /* corrupt or unavailable storage — fall back to fetching */
  }
}

function readSnapshot(): Snapshot {
  hydrate();
  return snapshot;
}

function persist(profile: ServerProfile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ profile, at: Date.now() }));
  } catch {
    /* private mode — caching degrades to in-memory only */
  }
}

/**
 * Fetch unless a fresh copy is already in hand. Concurrent callers share one
 * request rather than each firing their own.
 *
 * Exported so a caller can warm the cache before it is needed — hovering the
 * profile link, say — and so the caching behaviour can be tested without
 * rendering a component.
 */
export function ensureProfile(): Promise<void> {
  // Hydrate first. Reading the freshness of an un-hydrated snapshot would
  // report "nothing cached" and refetch a record already sitting in storage.
  // The React path happens to render (and so hydrate) before this runs, but
  // relying on that ordering is exactly how a cache quietly stops working.
  hydrate();

  // "Signed out" is an answer, not an absence of one. Treating only a loaded
  // profile as settled meant every subscriber refetched on mount and every
  // notify, so a signed-out visitor hammered the endpoint with 401s — three
  // components now read this store, and the menu made that immediately visible.
  const settled = snapshot.profile !== null || snapshot.anonymous;
  const fresh = settled && Date.now() - fetchedAt < STALE_AFTER_MS;
  if (fresh || inflight) return inflight ?? Promise.resolve();

  inflight = (async () => {
    try {
      const response = await fetch('/api/me/profile', { cache: 'no-store' });

      if (response.status === 401) {
        forgetProfile();
        publish({ loading: false, anonymous: true, profile: null });
        // After forgetProfile, which zeroes it. Without this the answer is
        // never considered fresh and the request repeats indefinitely.
        fetchedAt = Date.now();
        return;
      }
      if (!response.ok) {
        publish({ loading: false, error: await readError(response, 'Could not load your record.') });
        return;
      }

      const profile = (await response.json()) as ServerProfile;
      fetchedAt = Date.now();
      persist(profile);
      publish({ profile, loading: false, error: null, anonymous: false });
    } catch {
      // Offline. Keep a cached record on screen rather than replacing something
      // useful with an error nobody can act on.
      publish({
        loading: false,
        error: snapshot.profile ? null : 'Could not reach the duel server.',
      });
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function subscribeToStore(listener: () => void) {
  listeners.add(listener);
  // From subscribe rather than render, so it never runs during server
  // rendering. By now the cached record is already on screen.
  void ensureProfile();
  return () => { listeners.delete(listener); };
}

/**
 * Mark the record as changed, so the next reader refetches.
 *
 * Called when a duel ends: the server has just written a result, and the
 * cached copy no longer reflects it.
 */
export function invalidateProfile(): void {
  fetchedAt = 0;
}

/** Drop everything — call on sign-out, so the next person to sign in on this
 *  browser is never shown the previous one's record. */
export function forgetProfile(): void {
  fetchedAt = 0;
  snapshot = EMPTY;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
  listeners.forEach((notify) => notify());
}

/**
 * Write one or both names and fold the server's answer back into the cache.
 *
 * Module-level, so the identity is stable and no caller needs to memoise it.
 *
 * The fields are sent independently rather than as a whole profile: the two are
 * rationed differently upstream, and posting a handle that has not changed
 * alongside a new display name would spend a cooldown nobody asked to spend.
 */
async function savePatch(
  patch: {
    displayName?: string;
    handle?: string;
    character?: CharacterId;
    cosmetics?: { title?: string | null; badge?: string | null; nameColour?: string | null };
  },
  fallback: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/me/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    return { ok: false, error: await readError(response, fallback) };
  }

  const saved = (await response.json()) as {
    displayName: string;
    handle?: string;
    character?: CharacterId;
    cosmetics?: { earned: string[]; title?: string; badge?: string; nameColour?: string };
  };

  // Trust the server's version: it sanitises and canonicalises, so what came
  // back may differ from what was typed — a handle especially, since it is
  // lowercased and stripped. Writing it straight into the cache updates the
  // account chip and the dashboard immediately, with no refetch.
  if (snapshot.profile) {
    const profile = {
      ...snapshot.profile,
      displayName: saved.displayName,
      handle: saved.handle,
      character: saved.character,
      /**
       * The server's answer, not the request. It drops anything unearned or
       * retired rather than refusing the write, so what came back may be less
       * than what was asked for — and the panel must show what actually stuck.
       */
      cosmetics: saved.cosmetics
        ? { ...snapshot.profile.cosmetics, ...saved.cosmetics, catalogue: snapshot.profile.cosmetics?.catalogue ?? [] }
        : snapshot.profile.cosmetics,
    };
    fetchedAt = Date.now();
    persist(profile);
    publish({ profile });
  } else {
    invalidateProfile();
  }

  return { ok: true };
}

const saveName = (name: string) =>
  savePatch({ displayName: name }, 'Could not save that name.');

const saveHandle = (handle: string) =>
  savePatch({ handle }, 'Could not save that handle.');

const saveCharacter = (character: CharacterId) =>
  savePatch({ character }, 'Could not save that character.');

const saveCosmetics = (
  wanted: { title?: string | null; badge?: string | null; nameColour?: string | null },
) => savePatch({ cosmetics: wanted }, 'Could not save that.');

export function useServerProfile(): ProfileState {
  const state = useSyncExternalStore(subscribeToStore, readSnapshot, () => EMPTY);
  return { ...state, saveName, saveHandle, saveCharacter, saveCosmetics };
}

/**
 * The saved display name.
 *
 * Derived from the same store rather than fetched separately. It used to keep
 * its own cache and its own request against the very same endpoint, which is
 * how the menu and the dashboard ended up loading the record twice.
 *
 * Returns null while it is genuinely unknown. Callers must treat null and ''
 * differently: null means "do not render a name yet", '' means "they have not
 * chosen one, use the account name". See resolveDisplayName.
 */
export function useDisplayName(): string | null {
  return useSyncExternalStore(
    subscribeToStore,
    // A primitive, so identity comparison is a value comparison and this
    // re-renders only when the name itself changes.
    () => readSnapshot().profile?.displayName ?? null,
    () => null,
  );
}

/**
 * Your own handle, or null while it is unknown.
 *
 * Separate from useDisplayName because the two answer different questions and
 * only one of them is safe to compare. A display name is not unique, so
 * "is this row me?" answered by name is wrong whenever two players share one —
 * the leaderboard highlighted both of them as you. A handle is unique by
 * construction, which is the whole reason it exists.
 */
/**
 * The character you fight as.
 *
 * Falls back rather than returning null, because every caller needs something
 * to draw — a menu with a hole where a fighter should be is worse than a menu
 * showing the default for the moment before the profile lands.
 */
export function useCharacter(): CharacterId {
  return useSyncExternalStore(
    subscribeToStore,
    () => asCharacter(readSnapshot().profile?.character),
    () => DEFAULT_CHARACTER,
  );
}

/**
 * Everything this player may fight as, and how far off the rest is.
 *
 * Both come straight from the server, which derives them from the record — so
 * they cannot disagree with what `PUT /profile` will accept. The UI uses them
 * to grey things out, which is a courtesy; the endpoint is the control.
 *
 * Stable empty literals for the fallbacks, not fresh `[]` on every call.
 * `useSyncExternalStore` compares snapshots by identity and would otherwise
 * see a new array each time and re-render for ever.
 */
const NO_CHALLENGES: ChallengeProgress[] = [];
const ONLY_DEFAULT: CharacterId[] = [DEFAULT_CHARACTER];

export function useUnlocked(): CharacterId[] {
  return useSyncExternalStore(
    subscribeToStore,
    () => readSnapshot().profile?.unlocked ?? ONLY_DEFAULT,
    () => ONLY_DEFAULT,
  );
}

export function useChallenges(): ChallengeProgress[] {
  return useSyncExternalStore(
    subscribeToStore,
    () => readSnapshot().profile?.challenges ?? NO_CHALLENGES,
    () => NO_CHALLENGES,
  );
}

/**
 * The player's standing, for showing outside the profile page.
 *
 * A player asked to see it on the menu: they are not always on the visible
 * part of the board, and the number that moves after every ranked duel was
 * two clicks away from the screen they spend the most time on.
 *
 * Null while genuinely unknown, so a caller can render nothing rather than a
 * starting rating that is about to be replaced — a number that changes on its
 * own a second after you read it is worse than one that arrives late.
 */
export function useRating(): number | null {
  return useSyncExternalStore(
    subscribeToStore,
    () => readSnapshot().profile?.rating ?? null,
    () => null,
  );
}

export function useHandle(): string | null {
  return useSyncExternalStore(
    subscribeToStore,
    () => readSnapshot().profile?.handle ?? null,
    () => null,
  );
}

/**
 * Which name to show, given the saved one and the account's own.
 *
 * Extracted so the distinction can be tested. Collapsing `null` (not known yet)
 * into `''` (known, none chosen) is exactly what caused the account name to
 * flash on screen and then be rewritten — the two look alike and behave
 * completely differently.
 *
 * Returns null to mean "render nothing yet", never a guess.
 */
export function resolveDisplayName(saved: string | null, accountName: string): string | null {
  if (saved === null) return null;
  return saved || accountName;
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

export type {
  DuelResult, Tally, ServerProfile, ChallengeProgress,
} from '@/models/profile';
