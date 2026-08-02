'use client';

import { useEffect, useState } from 'react';
import { ratingFlame, START_RATING } from '@/models/rating';
import { Flame } from './RankFlame';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SignInLink from './SignInLink';
import { useFriends } from '@/game/friends';
import { EMPTY_TALLY, useHandle, winRate } from '@/game/serverProfile';
import { formatPlayTime, type PublicProfile as Profile } from '@/models/profile';
import { badgeSrc, badgeTooltip } from '@/models/cosmetics';
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
        <SignInLink from="public_profile" className={`btn btn-primary ${styles.cta}`}>Sign in</SignInLink>
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

  /**
   * An earned name colour, inline because the palette lives on the server and
   * a stylesheet cannot hold a colour it has not been told about. Undefined
   * rather than an empty object, so the default styling is untouched for the
   * great majority of players, who wear nothing.
   */
  const colour = profile.cosmetics?.nameColour ? { color: profile.cosmetics.nameColour } : undefined;

  // Derived from the list rather than tracked separately, so it stays right
  // after any change without this component knowing the rules.
  const already = friends.data.friends.some((f) => f.handle === profile.handle);
  const pending = friends.data.outgoing.some((f) => f.handle === profile.handle);
  const incoming = friends.data.incoming.some((f) => f.handle === profile.handle);

  return (
    <Shell>
      <header className={styles.header}>
        <h1 className={`${styles.name} pixel-font`} style={colour}>
          {/*
            * The badge leads the name rather than trailing it, which is the
            * opposite of the leaderboard and deliberate. A board row is a
            * column being scanned, so a badge before the name would put every
            * name at a different x; this is one heading being read, and a mark
            * in front of it is a mark on the person.
            */}
          {profile.cosmetics?.badge && (
            <span className={styles.badge} data-tip={badgeTooltip(profile.cosmetics)}>
              <img src={badgeSrc(profile.cosmetics.badge)} alt="" width={26} height={26} />
              {profile.cosmetics.badgeNumber !== undefined && (
                <span className={styles.badgeNo}>{profile.cosmetics.badgeNumber}</span>
              )}
            </span>
          )}
          {profile.displayName}
        </h1>
        <p className={styles.handle}>@{profile.handle}</p>
        {/* Here rather than on a board row, which has no width to spare for
            one. This is the surface titles were made for. */}
        {profile.cosmetics?.title && (
          <p className={`${styles.title} pixel-font`}>{profile.cosmetics.title}</p>
        )}
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
        {/* Absent from an older server rather than shown as zero: "0m" under
            a hundred duels is a claim the card cannot mean. */}
        {profile.playMs !== undefined && (
          <Stat label="Time played" value={formatPlayTime(profile.playMs)} />
        )}
        <Stat label="Win rate" value={rate ?? '—'} unit={rate === null ? '' : '%'} />
        <Stat label="Best accuracy" value={ranked.bestAccuracy} unit="%" />
      </dl>

      {/*
        * Everything they have unlocked, not just what they wear.
        *
        * In the order it was earned, because a collection is a history. Every
        * entry names itself on hover — the founder badge with its number,
        * everything else with its label — since unlike the owner's picker
        * there is no caption under each tile to say what a mark means.
        */}
      {(profile.collection?.length ?? 0) > 0 && (
        <section className={styles.collection} aria-label="Unlocked cosmetics">
          <h2 className={`${styles.collectionHeading} pixel-font`}>Collection</h2>
          <ul className={styles.collectionList}>
            {profile.collection!.map((item) => (
              <li
                key={`${item.kind}-${item.label}`}
                className={styles.collectionItem}
                data-kind={item.kind}
                data-tip={badgeTooltip({ badgeNumber: item.number, badgeLabel: item.label })}
              >
                {item.kind === 'badge' && item.value && (
                  <img src={badgeSrc(item.value)} alt={item.label} width={28} height={28} />
                )}
                {item.kind === 'badge' && item.number !== undefined && (
                  <span className={styles.badgeNo}>{item.number}</span>
                )}
                {item.kind === 'title' && <span>{item.label}</span>}
                {item.kind === 'nameColour' && (
                  <span style={{ color: item.value }}>{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
