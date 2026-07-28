'use client';

import { useEffect, useState } from 'react';
import { ratingFlame, START_RATING } from '@/models/rating';
import { Flame } from './RankFlame';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import { useFriends } from '@/game/friends';
import { EMPTY_TALLY, useHandle, winRate } from '@/game/serverProfile';
import type { PublicProfile as Profile } from '@/models/profile';
import { useUiSounds } from './SoundToggle';
import styles from './PublicProfile.module.css';

/**
 * Somebody else's profile.
 *
 * Shows strictly less than your own does, and the gap is deliberate rather than
 * unfinished: there is no duel history here, because history carries opponent
 * names and would publish who a player spends their evenings with and when they
 * were last at a keyboard. What is left is what the leaderboard already says
 * about its top ten.
 */

type Status = 'loading' | 'ready' | 'missing' | 'signedOut' | 'error';

export default function PublicProfile({ handle }: { handle: string }) {
  useUiSounds();
  const router = useRouter();
  const myHandle = useHandle();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  /**
   * Looking at yourself: go to the dashboard instead.
   *
   * The public card is a worse version of your own profile — it shows less and
   * can do nothing, and offering yourself an "Add friend" button is plainly
   * wrong. Links elsewhere already point your own row at /profile, so this is
   * the backstop for a URL typed, bookmarked or shared back to you.
   *
   * Compared against the *fetched* handle rather than the one in the URL. Old
   * handles keep resolving on purpose so shared links never break, which means
   * /u/an_old_handle_of_mine is also me — and matching on the URL alone would
   * miss it and show me a stranger's view of myself.
   */
  const mine = Boolean(myHandle) && profile?.handle === myHandle;

  useEffect(() => {
    // replace, not push: this page should not sit in history as a step to go
    // back to, or Back from the dashboard would bounce straight here again.
    if (mine) router.replace('/profile');
  }, [mine, router]);

  // Only enabled once we know the visitor is signed in, so a signed-out visitor
  // does not fire a request that can only 401.
  const friends = useFriends(status === 'ready');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const response = await fetch(`/api/players/${encodeURIComponent(handle)}`, {
          cache: 'no-store',
        });
        if (!live) return;

        // The upstream route is authenticated, so a 401 here means "sign in to
        // look at this", not "this player does not exist".
        if (response.status === 401) return setStatus('signedOut');
        if (response.status === 404) return setStatus('missing');
        if (!response.ok) return setStatus('error');

        setProfile((await response.json()) as Profile);
        setStatus('ready');
      } catch {
        if (live) setStatus('error');
      }
    })();

    return () => { live = false; };
  }, [handle]);

  // Covers the frame between knowing it is you and the router acting, so the
  // wrong page never paints even for one frame.
  if (status === 'loading' || mine) {
    return <Shell><p className={styles.muted}>Loading…</p></Shell>;
  }

  if (status === 'signedOut') {
    return (
      <Shell>
        <p className={styles.muted}>Sign in to look at other players&apos; profiles.</p>
        <LoginLink className={`btn btn-primary ${styles.cta}`}>Sign in</LoginLink>
      </Shell>
    );
  }

  if (status === 'missing') {
    return <Shell><p className={styles.muted}>No player goes by @{handle}.</p></Shell>;
  }

  if (status === 'error' || !profile) {
    return <Shell><p className={styles.error}>Could not load that profile.</p></Shell>;
  }

  const ranked = profile.ranked ?? EMPTY_TALLY;
  const rate = winRate(ranked);

  // Derived from the list rather than tracked separately, so it stays right
  // after any change without this component knowing the rules.
  const already = friends.data.friends.some((f) => f.handle === profile.handle);
  const pending = friends.data.outgoing.some((f) => f.handle === profile.handle);
  const incoming = friends.data.incoming.some((f) => f.handle === profile.handle);

  return (
    <Shell>
      <header className={styles.header}>
        <h1 className={`${styles.name} pixel-font`}>{profile.displayName}</h1>
        <p className={styles.handle}>@{profile.handle}</p>
      </header>

      <dl className={styles.stats}>
        {/* Leads, because it is the only figure here that compares this player
            to the person reading it rather than to themselves. */}
        <Stat
          label="Rating"
          value={profile.rating ?? START_RATING}
          icon={<Flame kind={ratingFlame(profile.rating ?? START_RATING)} height={19} />}
          highlight
        />
        <Stat label="Best speed" value={profile.bestRankedWpm} unit="wpm" highlight />
        <Stat label="Ranked duels" value={ranked.duels} />
        <Stat label="Win rate" value={rate ?? '—'} unit={rate === null ? '' : '%'} />
        <Stat label="Best accuracy" value={ranked.bestAccuracy} unit="%" />
      </dl>

      <div className={styles.actions}>
        {already && <span className={styles.settled}>You are friends.</span>}
        {incoming && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={friends.busy}
            onClick={() => friends.accept(profile.handle)}
          >
            Accept request
          </button>
        )}
        {!already && !incoming && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={friends.busy || pending || sent}
            onClick={async () => {
              const result = await friends.add(profile.handle);
              setSent(result.ok);
            }}
          >
            {pending || sent ? 'Request sent' : 'Add friend'}
          </button>
        )}
        <Link href="/profile" className="btn btn-ghost">Your profile</Link>
      </div>

      <p className={styles.footnote}>
        Only server-refereed duels are shown. Practice against bots is a player&apos;s
        own business.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={`panel ${styles.card}`}>
        <Link href="/" className={styles.back}>← Menu</Link>
        {children}
      </div>
    </main>
  );
}

function Stat({ icon, label, value, unit, highlight }: {
  /** Sits beside the figure. Used for the rating's flame. */
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className={styles.stat} data-highlight={highlight || undefined}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font`}>
        {icon}
        {value}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </dd>
    </div>
  );
}
