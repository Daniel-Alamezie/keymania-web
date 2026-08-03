'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Where the player was before this page.
 *
 * Exists because a "Back" control has to answer a question the router cannot:
 * `router.back()` is right when somebody arrived by clicking a link and wrong
 * when they arrived by opening a shared one, where it walks them out of the
 * site entirely. Knowing the previous *in-app* path tells the two cases apart
 * — there either is one or there isn't.
 *
 * `sessionStorage` rather than a context or a store, because it has to survive
 * a full page load: a link into /u/somebody from the friends list is a client
 * navigation, but a refresh on that page is not, and a value held in memory
 * would be gone exactly when it was needed.
 */

const KEY = 'keymania.from';

/** Remember the page being left. Mounted once, in the layout. */
export function useTrackPath(): void {
  const pathname = usePathname();

  useEffect(() => {
    /**
     * Written on the way *out* rather than on arrival.
     *
     * The cleanup of this effect runs when the pathname changes, at which
     * point `pathname` still holds the page being left — which is precisely
     * the value the next page wants. Recording on arrival instead would
     * require reading the value before overwriting it, and would be wrong on
     * the very first page of a session.
     */
    return () => {
      try {
        window.sessionStorage.setItem(KEY, pathname);
      } catch {
        // Private browsing, or storage disabled. Back controls fall back to
        // their default destination, which is where they pointed before this
        // existed anyway.
      }
    };
  }, [pathname]);
}

/** What page to offer going back to, or null if there is no in-app history. */
export function previousPath(current: string): string | null {
  try {
    const from = window.sessionStorage.getItem(KEY);
    /**
     * A path only, and never the page you are already on.
     *
     * The leading-slash check keeps this from becoming an open redirect if
     * anything ever writes to that key: a value like `//evil.example` is a
     * protocol-relative URL that a router would happily follow off-site.
     */
    if (!from || !from.startsWith('/') || from.startsWith('//') || from === current) return null;
    return from;
  } catch {
    return null;
  }
}

/** What a path is called, for labelling the control rather than guessing. */
export function pathLabel(path: string): string {
  if (path === '/profile') return 'Profile';
  if (path === '/leaderboard') return 'Leaderboard';
  if (path === '/') return 'Menu';
  if (path.startsWith('/u/')) return 'Back';
  return 'Back';
}
