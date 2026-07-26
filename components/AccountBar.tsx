'use client';

import Link from 'next/link';
import { LoginLink, LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { useAccount } from '@/game/useAccount';
import { useDisplayName } from '@/game/serverProfile';
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

  // The name they chose wins. Their Kinde name is only a stand-in until they
  // set one — and it is what shows while the saved name is still loading, so
  // the chip never flashes empty.
  const shown = saved || displayName;

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
          <span className={styles.initial}>{shown.charAt(0).toUpperCase()}</span>
        )}
        <span className={styles.name}>{shown}</span>
      </Link>
      <LogoutLink className={styles.signOut}>Sign out</LogoutLink>
    </div>
  );
}
