'use client';

import { useEffect, useSyncExternalStore } from 'react';
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

/**
 * Whether this browser was signed in the last time it looked.
 *
 * Kinde resolves the session over the network, and that takes long enough to
 * see. Until it answers, `isAuthenticated` is false — indistinguishable from
 * "signed out" — so every refresh flashed "Sign in to play others" at people
 * who were already signed in, then swapped it for the Multiplayer button.
 *
 * A remembered hint closes the gap. It is read synchronously, so the first
 * paint after a refresh is already right for anyone who was signed in before.
 *
 * **It is a hint and never an authority.** Nothing is authorised on the
 * strength of it: every privileged call carries a real token attached
 * server-side, and Kinde's verdict replaces this the moment it arrives. The
 * worst a stale hint can do is show a button that turns into a sign-in prompt
 * a moment later — the same flash it removes, in the rarer direction, and only
 * for somebody whose session ended somewhere else.
 */
const REMEMBERED = 'keymania.signedIn';

const readHint = (): boolean => {
  try {
    return window.localStorage.getItem(REMEMBERED) === '1';
  } catch {
    // Private browsing, or storage disabled. Falling back to "signed out" is
    // the safe direction: right for a first visit, merely unhelpful for a
    // returning player.
    return false;
  }
};

const writeHint = (signedIn: boolean): void => {
  try {
    if (signedIn) window.localStorage.setItem(REMEMBERED, '1');
    else window.localStorage.removeItem(REMEMBERED);
  } catch { /* storage unavailable; the hint is optional by design */ }
};

/**
 * Subscribing to nothing, on purpose.
 *
 * The hint is read once per mount and then superseded by Kinde, so there is no
 * change to listen for. This goes through `useSyncExternalStore` only because
 * that is the sanctioned way to let the server and the client legitimately
 * disagree: `localStorage` cannot be read during a server render, and reading
 * it from `useState` instead would be a hydration mismatch rather than an
 * intended difference.
 */
const subscribe = () => () => {};

export function useAccount(): Account {
  const { user, isLoading, isAuthenticated } = useKindeBrowserClient();

  const known = !isLoading;
  const confirmed = Boolean(isAuthenticated && user);

  // The server has neither localStorage nor a session, so it renders as though
  // signed out and the client corrects it on the first commit.
  const remembered = useSyncExternalStore(subscribe, readHint, () => false);

  useEffect(() => {
    if (known) writeHint(confirmed);
  }, [known, confirmed]);

  const displayName =
    [user?.given_name, user?.family_name].filter(Boolean).join(' ').trim() ||
    user?.email?.split('@')[0] ||
    'Challenger';

  return {
    loading: !known,
    // Kinde's answer once there is one; the remembered hint until then.
    signedIn: known ? confirmed : remembered,
    // Deliberately not guessed. A hint is enough to decide which button to
    // draw; it is nowhere near enough to name somebody or key their record, so
    // these stay empty until the session is real.
    id: user?.id ?? null,
    displayName,
    avatar: user?.picture ?? null,
  };
}
