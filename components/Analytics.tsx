'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/game/useAccount';
import {
  identify, resetIdentity, setSignedIn, startAnalytics, track, trackPageView,
} from '@/game/analytics';
import { claimSignInReturn } from '@/game/signInTrip';

/**
 * Starts analytics and keeps it in step with the route and the session.
 *
 * A component rather than a call in the layout, because both jobs need hooks:
 * the App Router changes route without a page load, and the account resolves
 * asynchronously after the first paint. Neither can be handled from a server
 * component, and both are wrong if handled once at start-up.
 *
 * Renders nothing. It exists to have effects.
 */
export default function Analytics() {
  const pathname = usePathname();
  const account = useAccount();

  useEffect(() => { startAnalytics(); }, []);

  /**
   * A page view per route change.
   *
   * PostHog's automatic capture fires on load, which in an App Router
   * application means once per session however many pages somebody visits —
   * so the profile and the public-profile pages would have looked unvisited.
   */
  useEffect(() => {
    if (pathname) trackPageView(window.location.href);
  }, [pathname]);

  /**
   * Identify on sign-in, forget on sign-out.
   *
   * `loading` is checked rather than just `signedIn`, because the account hook
   * reports an optimistic guess from localStorage before Kinde answers — and
   * identifying somebody on a guess would attach a session to an account that
   * may turn out to have expired.
   */
  useEffect(() => {
    if (account.loading) return;
    if (account.signedIn && account.id) identify(account.id);
    else resetIdentity();
  }, [account.loading, account.signedIn, account.id]);

  /**
   * Stamp every event with whether this browser has an account.
   *
   * After the identify effect above, because `resetIdentity` clears super
   * properties — registering first would have it wiped on the same commit, and
   * every signed-out event would arrive with the property missing rather than
   * false. Ordering here is load-bearing rather than incidental.
   *
   * Waits for `loading` for the same reason identify does: the account hook
   * answers from a localStorage hint before Kinde replies, and stamping a guess
   * onto events would mislabel the exact population this exists to count.
   */
  useEffect(() => {
    if (account.loading) return;
    setSignedIn(account.signedIn);
  }, [account.loading, account.signedIn]);

  /**
   * The return leg of a sign-in.
   *
   * Only once the session is real: on a redirect back there is no signed-out
   * render to transition from, so this cannot watch for a change — it asks
   * whether a trip is outstanding and whether it ended in an account.
   *
   * Guarded by a ref as well as by the marker being consumed. Effects run twice
   * in development under StrictMode, and a funnel that double-counts its own
   * success metric is worse than one that does not exist.
   */
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current || account.loading || !account.signedIn) return;
    claimed.current = true;

    const trip = claimSignInReturn();
    if (trip) track({ name: 'signin_returned', from: trip.from, seconds: trip.seconds });
  }, [account.loading, account.signedIn]);

  return null;
}
