'use client';

import Link from 'next/link';
import { LoginLink, LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { useAccount } from '@/game/useAccount';
import { forgetDisplayName, useDisplayName } from '@/game/serverProfile';
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

  /**
   * null means we genuinely do not know yet, so nothing is rendered rather
   * than the account name — showing that and then rewriting it to the chosen
   * username is the flicker. '' means we do know, and they have not chosen
   * one, so the account name is the right answer.
   *
   * After a first visit the name comes out of localStorage synchronously, so
   * this placeholder is only ever seen once.
   */
  const shown = saved === null ? null : saved || displayName;

  // Render nothing rather than a flash of "signed out" while the session
  // is still being checked.
  if (loading) return <div className={styles.bar} aria-hidden="true" />;

  if (!signedIn) {
    return (
      <div className={styles.bar}>
        <LoginLink className={`btn btn-ghost ${styles.action}`}>
          Sign in
          <small className="btn-sub">to duel humans</small>
        </LoginLink>
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
        onClick={() => { forgetDisplayName(); forgetDuelToken(); }}
      >
        Sign out
      </LogoutLink>
    </div>
  );
}
