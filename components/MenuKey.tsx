'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components';
import SignInLink from './SignInLink';
import PixelSprite from './PixelSprite';
import { useAccount } from '@/game/useAccount';
import { audio, useSoundEnabled } from '@/game/audio';
import {
  forgetProfile, resolveDisplayName, servableEarnedIds, useDisplayName, useServerProfile,
} from '@/game/serverProfile';
import { useUnseenCosmetics } from '@/game/seenCosmetics';
import { forgetDuelToken } from '@/game/duelToken';
import styles from './MenuKey.module.css';

/**
 * Everything in the corners, folded into one key. Phones only.
 *
 * Four separate controls used to sit across the top of the menu — mute,
 * settings, the identity chip and Sign out — which is a reasonable desktop
 * arrangement and a bad phone one. At 375px they crowded the title and Sign
 * out ran off the right edge entirely, so the one control a player might
 * genuinely need in a hurry was the one they could not reach.
 *
 * A keycap rather than a hamburger. The hamburger is the honest default and
 * says nothing about this game; a key is what KeyMania is made of, it is
 * already the vocabulary of the SPACE hint on this very screen, and it gives
 * the player's initial somewhere to live that reads as a cap with a letter on
 * it rather than as an avatar bubble.
 *
 * Nothing is removed by this — every control the desktop bar offers is one tap
 * away. Hiding things a player cannot find again is how a tidy interface
 * becomes a worse one.
 */
export default function MenuKey({ onSettings }: { onSettings: () => void }) {
  const { loading, signedIn, avatar, displayName } = useAccount();
  const saved = useDisplayName();
  const shown = resolveDisplayName(saved, displayName);
  const soundOn = useSoundEnabled();
  const { profile } = useServerProfile();
  // Unlocks owned but not yet looked at, same count the desktop chip shows.
  // The whole bar is hidden on phones, so without this the nudge never reaches
  // the players most likely to be on one.
  const unseen = useUnseenCosmetics(servableEarnedIds(profile?.cosmetics));
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /**
   * Close on Escape and on a tap outside.
   *
   * A pointer listener rather than focus, because this is the phone layout and
   * a tap on the backdrop of a touch screen moves no focus at all — the menu
   * would sit open until something else was pressed.
   */
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  // Nothing at all until the session resolves, rather than a key that changes
  // meaning under the player's thumb a moment after they look at it.
  if (loading) return <div className={styles.slot} aria-hidden="true" />;

  /**
   * Signed out, this is not a menu — it is one thing to do.
   *
   * Putting Sign in behind a tap would hide the only action that matters to a
   * first-time visitor behind a control they have no reason to press.
   */
  if (!signedIn) {
    return (
      <div className={styles.slot}>
        <SignInLink from="menu_key" className={`btn btn-ghost ${styles.signIn}`}>
          Sign in
        </SignInLink>
      </div>
    );
  }

  return (
    <div className={styles.slot} ref={wrap}>
      <button
        type="button"
        className={styles.key}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          shown
            ? `Menu for ${shown}${unseen > 0 ? `, ${unseen} new to see` : ''}`
            : 'Menu'
        }
        onClick={() => setOpen((was) => !was)}
      >
        {avatar ? (
          // Kinde serves avatars from its own domain; a plain img avoids
          // configuring a remote pattern for a 22px picture.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={avatar} alt="" width={22} height={22} />
        ) : (
          <span className={styles.initial}>{shown ? shown.charAt(0).toUpperCase() : '?'}</span>
        )}
        {/* The nudge, when the bar it normally lives in is folded away. */}
        {unseen > 0 && <span className={styles.dot} aria-hidden="true" />}
      </button>

      {open && (
        <div className={styles.sheet} role="menu">
          {/* The name is a label, not a control: it says whose menu this is,
              which the initial alone cannot once there are two accounts on a
              shared phone. */}
          {shown && <p className={styles.who}>{shown}</p>}

          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => audio.toggle()}
          >
            <PixelSprite name={soundOn ? 'sound-on' : 'sound-off'} height={14} />
            <span>{soundOn ? 'Mute sound' : 'Unmute sound'}</span>
          </button>

          {/* Stays open on purpose. Muting is a thing you might do twice in a
              row, and a menu that closes under you makes the second tap a
              hunt. Everything below leaves this screen, so those close. */}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => { setOpen(false); onSettings(); }}
          >
            <PixelSprite name="settings" height={14} />
            <span>Settings</span>
          </button>

          <Link
            href="/profile"
            role="menuitem"
            className={styles.item}
            onClick={() => setOpen(false)}
          >
            <span className={styles.glyph} aria-hidden="true">@</span>
            <span>Your profile</span>
          </Link>

          {/* Clear the cached identity before the browser leaves, so the next
              person to sign in here is never briefly greeted by this one's
              name. Same reason as the desktop bar; the logic cannot live in
              only one of them. */}
          <LogoutLink
            className={`${styles.item} ${styles.leave}`}
            onClick={() => { forgetProfile(); forgetDuelToken(); }}
          >
            <span className={styles.glyph} aria-hidden="true">×</span>
            <span>Sign out</span>
          </LogoutLink>
        </div>
      )}
    </div>
  );
}
