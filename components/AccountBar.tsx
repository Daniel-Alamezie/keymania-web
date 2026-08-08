'use client';

import Link from 'next/link';
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import SignInLink from './SignInLink';
import { useAccount } from '@/game/useAccount';
import {
  forgetProfile, resolveDisplayName, servableEarnedIds, useDisplayName, useServerProfile,
} from '@/game/serverProfile';
import { useUnseenCosmetics } from '@/game/seenCosmetics';
import { forgetDuelToken } from '@/game/duelToken';
import styles from './AccountBar.module.css';

/**
 * Who you are, top-right of the menu.
 *
 * Signing in is presented as unlocking multiplayer rather than a gate you must
 * pass — practice against the bots never asks for an account, so a first-time
 * visitor can play immediately.
 */
export default function AccountBar() {
  const { loading, signedIn, displayName, avatar } = useAccount();
  const saved = useDisplayName();
  const { profile } = useServerProfile();

  // How many owned cosmetics this browser has not shown yet. Counted against
  // the servable set, not raw `earned`, so it matches what the profile grid
  // marks seen when they open it — otherwise the dot would never clear.
  // Hooks run before the early returns below, as the rules require.
  const unseen = useUnseenCosmetics(servableEarnedIds(profile?.cosmetics));

  // null means "not known yet, render nothing" rather than a guess at the
  // account name — see resolveDisplayName. After a first visit the name comes
  // out of localStorage synchronously, so the placeholder is rarely seen.
  const shown = resolveDisplayName(saved, displayName);

  // Render nothing rather than a flash of "signed out" while the session
  // is still being checked.
  if (loading) return <div className={styles.bar} aria-hidden="true" />;

  if (!signedIn) {
    return (
      <div className={styles.bar}>
        <SignInLink from="account_bar" className={`btn btn-ghost ${styles.action}`}>
          Sign in
          <small className="btn-sub">to play others</small>
        </SignInLink>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      {/*
        * One keycap holding the whole identity: the way into the dashboard and
        * the way out of the session, sharing a single pressable object rather
        * than a flat chip with a bare link floating beside it. The weighted
        * bottom edge is the same one every `.kbd` in the game wears.
        */}
      <div className={styles.chip} data-unlock={unseen > 0 || undefined}>
        {/* The identity is the way into the dashboard — where else would you
            click to change your name? */}
        <Link href="/profile" className={styles.identity} title="Your profile">
          <span className={styles.face}>
            {avatar ? (
              // Kinde serves avatars from its own domain; a plain img avoids
              // configuring a remote pattern for a 26px picture.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.avatar} src={avatar} alt="" width={26} height={26} />
            ) : (
              <span className={styles.initial}>
                {shown ? shown.charAt(0).toUpperCase() : ''}
              </span>
            )}
            {/* The nudge: a gold count when something owned has not been looked
                at, in the game's reward colour so it reads as "collect me". It
                clears itself the moment the profile is opened. */}
            {unseen > 0 && (
              <span
                className={styles.badge}
                aria-label={`${unseen} new ${unseen === 1 ? 'unlock' : 'unlocks'} to see`}
              >
                {unseen > 9 ? '9+' : unseen}
              </span>
            )}
          </span>
          {shown === null
            ? <span className={styles.pending} aria-label="Loading your name" />
            : <span className={styles.name}>{shown}</span>}
        </Link>

        <span className={styles.divider} aria-hidden="true" />

        {/* Clear the cached identity before the browser leaves, so the next
            person to sign in here is never briefly greeted by this one's name. */}
        <LogoutLink
          className={styles.out}
          title="Sign out"
          aria-label="Sign out"
          onClick={() => { forgetProfile(); forgetDuelToken(); }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </LogoutLink>
      </div>
    </div>
  );
}
