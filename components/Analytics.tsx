'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAccount } from '@/game/useAccount';
import { identify, resetIdentity, startAnalytics, trackPageView } from '@/game/analytics';

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

  return null;
}
