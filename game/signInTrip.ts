'use client';

import type { SignInSource } from './analytics';

/**
 * Remembering that somebody left to sign in, so their return can be recognised.
 *
 * Signing in is two page loads with a third party in between, which means the
 * press and the arrival back cannot see each other. Without something spanning
 * them, "never pressed sign in" and "pressed it and was lost at the identity
 * provider" produce the same shape in the data — and those are the two most
 * different problems on the list, with opposite fixes.
 *
 * `sessionStorage` rather than `localStorage`, deliberately. This is about one
 * trip in one tab; a marker that outlived the tab would credit a sign-in to a
 * visit that happened days later, which is worse than not measuring it.
 */

const KEY = 'keymania.signInTrip';

/**
 * How long a trip may take and still count as one.
 *
 * Somebody who presses sign in, wanders off, and comes back to the tab an hour
 * later did not complete a sign-in flow in any sense worth measuring — and
 * counting them would flatter exactly the number this exists to scrutinise. Ten
 * minutes is generous for a flow that normally takes twenty seconds, including
 * a first-time account creation and a detour to find a password.
 */
const TRIP_EXPIRY_MS = 10 * 60 * 1000;

interface Trip {
  from: SignInSource;
  at: number;
}

/** Note that a sign-in trip has begun, and from where. */
export function markSignInStarted(from: SignInSource): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ from, at: Date.now() }));
  } catch {
    // Private browsing, or storage disabled. The outbound event is already
    // recorded; only the pairing is lost, which under-reports returns rather
    // than inventing them. That is the safe direction for a number whose whole
    // purpose is to be doubted.
  }
}

/**
 * Claim a completed trip, if there is one to claim.
 *
 * Consuming rather than reading: it must fire once per sign-in, and a marker
 * left behind would fire again on every route change for the rest of the tab's
 * life. Cleared before the expiry check too, so a stale marker cannot sit there
 * being re-examined forever.
 */
export function claimSignInReturn(): { from: SignInSource; seconds: number } | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
    if (raw) window.sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const trip = JSON.parse(raw) as Trip;
    const elapsed = Date.now() - trip.at;
    if (!trip.from || !(elapsed >= 0) || elapsed > TRIP_EXPIRY_MS) return null;
    return { from: trip.from, seconds: Math.round(elapsed / 1000) };
  } catch {
    // Somebody else's key, or a shape from an older version of this file.
    return null;
  }
}
