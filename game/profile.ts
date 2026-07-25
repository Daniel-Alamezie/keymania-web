'use client';

import { useSyncExternalStore } from 'react';
import type { DuelStats } from './duelReducer';

/**
 * The player's own record, kept in localStorage.
 *
 * Exposed through `useSyncExternalStore` rather than an effect: localStorage
 * does not exist during server rendering, so this is exactly the "external
 * store with a server snapshot" case that hook exists for. Reading it during
 * render would break hydration; setting it from an effect would cascade renders.
 */
export interface Profile {
  name: string;
  duels: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  bestCombo: number;
  /** Most recent results, newest first. */
  recent: { wpm: number; accuracy: number; won: boolean; at: number }[];
}

const KEY = 'keymania.profile.v1';
const RECENT_LIMIT = 5;

export const EMPTY_PROFILE: Profile = {
  name: '', duels: 0, wins: 0, bestWpm: 0, bestAccuracy: 0, bestCombo: 0, recent: [],
};

const listeners = new Set<() => void>();
// getSnapshot must return a stable reference or React re-renders forever, so
// the parsed profile is cached and only replaced when it genuinely changes.
let cache: Profile | null = null;

function read(): Profile {
  if (cache) return cache;
  if (typeof window === 'undefined') return EMPTY_PROFILE;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY_PROFILE, ...(JSON.parse(raw) as Profile) } : EMPTY_PROFILE;
  } catch {
    cache = EMPTY_PROFILE;
  }
  return cache;
}

function write(next: Profile) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — the record simply will not persist */
  }
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read the player's record, SSR-safe. */
export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, read, () => EMPTY_PROFILE);
}

export function setName(name: string) {
  write({ ...read(), name: name.slice(0, 16) });
}

/** Fold a finished duel into the record. */
export function recordDuel(stats: DuelStats, won: boolean, wpm: number, acc: number) {
  const current = read();
  write({
    ...current,
    duels: current.duels + 1,
    wins: current.wins + (won ? 1 : 0),
    bestWpm: Math.max(current.bestWpm, wpm),
    bestAccuracy: Math.max(current.bestAccuracy, acc),
    bestCombo: Math.max(current.bestCombo, stats.maxCombo),
    recent: [{ wpm, accuracy: acc, won, at: Date.now() }, ...current.recent].slice(0, RECENT_LIMIT),
  });
}

export const winRate = (p: Profile): number =>
  p.duels === 0 ? 0 : Math.round((p.wins / p.duels) * 100);
