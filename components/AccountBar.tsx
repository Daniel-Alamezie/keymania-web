'use client';

import Link from 'next/link';
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import SignInLink from './SignInLink';
import { useAccount } from '@/game/useAccount';
import { forgetProfile, resolveDisplayName, useDisplayName } from '@/game/serverProfile';
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
      {/* The whole identity chip is the way into the dashboard — where else
          would you click to change your name? */}
      <Link href="/profile" className={styles.who} title="Your profile">
        {avatar ? (
          // Kinde serves avatars from its own domain; a plain img avoids
          // configuring a remote pattern for a 24px picture.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={avatar} alt="" width={24} height={24} />
        ) : (
          <span className={styles.initial}>
            {shown ? shown.charAt(0).toUpperCase() : ''}
          </span>
        )}
        {shown === null
          ? <span className={styles.pending} aria-label="Loading your name" />
          : <span className={styles.name}>{shown}</span>}
      </Link>
      {/* Clear the cached identity before the browser leaves, so the next
          person to sign in here is never briefly greeted by this one's name. */}
      <LogoutLink
        className={styles.signOut}
        onClick={() => { forgetProfile(); forgetDuelToken(); }}
      >
        Sign out
      </LogoutLink>
    </div>
  );
}
