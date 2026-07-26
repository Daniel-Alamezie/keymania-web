'use client';

import { useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs';

/**
 * The player's account, reduced to what the game actually cares about.
 *
 * Wrapping Kinde here rather than calling it from components keeps the identity
 * provider behind one seam: swapping Kinde for Cognito or anything else that
 * issues a standard JWT would change this file and nothing else.
 */
export interface Account {
  /** Still checking the session — render neither signed-in nor signed-out UI. */
  loading: boolean;
  signedIn: boolean;
  /** Stable identifier, used as the leaderboard key. */
  id: string | null;
  /** What to show on the scoreboard. */
  displayName: string;
  avatar: string | null;
}

export function useAccount(): Account {
  const { user, isLoading, isAuthenticated } = useKindeBrowserClient();

  const displayName =
    [user?.given_name, user?.family_name].filter(Boolean).join(' ').trim() ||
    user?.email?.split('@')[0] ||
    'Challenger';

  return {
    loading: Boolean(isLoading),
    signedIn: Boolean(isAuthenticated && user),
    id: user?.id ?? null,
    displayName,
    avatar: user?.picture ?? null,
  };
}
