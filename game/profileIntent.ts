'use client';

/**
 * "Open the profile on this tab", from wherever the ask was made.
 *
 * The profile's tabs are deliberately not in the URL — a tab is not a place
 * somebody links to (see ProfileDashboard). But the challenge toast floats
 * above every page and its whole job is to deliver somebody *to* the
 * Challenges tab; without a handoff it could only drop them at the profile's
 * front door and hope. This is `joinIntent`'s idiom for the same shaped
 * problem: a short-lived intent carried across one navigation, parked in
 * sessionStorage so a slow route change cannot lose it, consumed on read so
 * a refresh cannot replay it.
 */

const KEY = 'keymania.profileTab';

/** The tabs the dashboard actually has; anything else is dropped on read. */
const TABS = ['profile', 'challenges', 'characters', 'look'] as const;
export type ProfileTab = (typeof TABS)[number];

export function offerProfileTab(tab: ProfileTab): void {
  try {
    window.sessionStorage.setItem(KEY, tab);
  } catch {
    // Private browsing. The navigation still happens; the player lands on the
    // default tab and the Challenges tab wears its own "new" mark anyway.
  }
}

/** Read a parked tab and forget it, so a refresh lands on the default again. */
export function takeProfileTab(): ProfileTab | null {
  try {
    const parked = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return TABS.includes(parked as ProfileTab) ? (parked as ProfileTab) : null;
  } catch {
    return null;
  }
}
